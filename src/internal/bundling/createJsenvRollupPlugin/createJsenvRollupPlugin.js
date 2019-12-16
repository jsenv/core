/* eslint-disable import/max-dependencies */
import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import {
  hasScheme,
  urlToFilePath,
  filePathToUrl,
  resolveUrl,
  fileUrlToRelativePath,
  resolveDirectoryUrl,
} from "internal/urlUtils.js"
import { writeFileContent } from "internal/filesystemUtils.js"
import { writeSourceMappingURL } from "internal/sourceMappingURLUtils.js"
import { fetchUrl } from "internal/fetchUrl.js"
import { validateResponseStatusIsOk } from "internal/validateResponseStatusIsOk.js"
import { transformJs } from "internal/compiling/js-compilation-service/transformJs.js"
import { findAsyncPluginNameInBabelPluginMap } from "internal/compiling/js-compilation-service/findAsyncPluginNameInBabelPluginMap.js"

import { fetchSourcemap } from "./fetchSourcemap.js"
import { minifyHtml } from "./minifyHtml.js"
import { minifyJs } from "./minifyJs.js"
import { minifyCss } from "./minifyCss.js"

export const createJsenvRollupPlugin = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  entryPointMap,
  bundleDirectoryUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  compileServerImportMap,
  importDefaultExtension,

  babelPluginMap,
  format,
  minify,
  // https://github.com/terser/terser#minify-options
  minifyJsOptions,
  // https://github.com/jakubpawlowicz/clean-css#constructor-options
  minifyCssOptions,
  // https://github.com/kangax/html-minifier#options-quick-reference
  minifyHtmlOptions,

  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global",
}) => {
  const moduleContentMap = {}
  const redirectionMap = {}
  const compileDirectoryRemoteUrl = resolveDirectoryUrl(
    compileDirectoryRelativeUrl,
    compileServerOrigin,
  )
  const chunkId = `${Object.keys(entryPointMap)[0]}.js`
  const importMap = normalizeImportMap(compileServerImportMap, compileDirectoryRemoteUrl)

  const jsenvRollupPlugin = {
    name: "jsenv",

    resolveId: (specifier, importer = compileDirectoryRemoteUrl) => {
      if (!hasScheme(importer)) {
        importer = filePathToUrl(importer)
      }
      const importUrl = resolveImport({
        specifier,
        importer,
        importMap,
        defaultExtension: importDefaultExtension,
      })
      // const rollupId = urlToRollupId(importUrl, { projectDirectoryUrl, compileServerOrigin })
      logger.debug(`${specifier} resolved to ${importUrl}`)
      return importUrl
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {

    // },

    load: async (url) => {
      logger.debug(`loads ${url}`)
      const { responseUrl, contentRaw, content, map } = await loadModule(url)

      saveModuleContent(responseUrl, {
        content,
        contentRaw,
      })
      // handle redirection
      if (responseUrl !== url) {
        saveModuleContent(url, {
          content,
          contentRaw,
        })
        redirectionMap[url] = responseUrl
      }

      return { code: content, map }
    },

    // resolveImportMeta: () => {}

    // transform should not be required anymore as
    // we will receive
    // transform: async (moduleContent, rollupId) => {}

    outputOptions: (options) => {
      // rollup does not expects to have http dependency in the mix

      const bundleSourcemapFileUrl = resolveUrl(`./${chunkId}.map`, bundleDirectoryUrl)

      // options.sourcemapFile = bundleSourcemapFileUrl

      const relativePathToUrl = (relativePath) => {
        const rollupUrl = resolveUrl(relativePath, bundleSourcemapFileUrl)
        let url

        // fix rollup not supporting source being http
        const httpIndex = rollupUrl.indexOf(`http:/`)
        if (httpIndex > -1) {
          url = `http://${rollupUrl.slice(httpIndex + `http:/`.length)}`
        } else {
          const httpsIndex = rollupUrl.indexOf("https:/")
          if (httpsIndex > -1) {
            url = `http://${rollupUrl.slice(httpIndex + `http:/`.length)}`
          } else {
            url = rollupUrl
          }
        }

        if (url in redirectionMap) {
          return redirectionMap[url]
        }
        return url
      }

      options.sourcemapPathTransform = (relativePath) => {
        const url = relativePathToUrl(relativePath)

        if (url.startsWith(compileServerOrigin)) {
          const relativeUrl = url.slice(`${compileServerOrigin}/`.length)
          const fileUrl = `${projectDirectoryUrl}${relativeUrl}`
          relativePath = fileUrlToRelativePath(fileUrl, bundleSourcemapFileUrl)
          return relativePath
        }
        if (url.startsWith(projectDirectoryUrl)) {
          return relativePath
        }

        return url
      }
      return options
    },

    renderChunk: (source) => {
      if (!minify) return null

      // https://github.com/terser-js/terser#minify-options
      const result = minifyJs(source, {
        sourceMap: true,
        ...(format === "global" ? { toplevel: false } : { toplevel: true }),
        ...minifyJsOptions,
      })
      if (result.error) {
        throw result.error
      } else {
        return result
      }
    },

    writeBundle: async (bundle) => {
      if (detectAndTransformIfNeededAsyncInsertedByRollup) {
        await transformAsyncInsertedByRollup({
          projectDirectoryUrl,
          bundleDirectoryUrl,
          babelPluginMap,
          bundle,
        })
      }

      Object.keys(bundle).forEach((bundleFilename) => {
        logger.info(`-> ${bundleDirectoryUrl}${bundleFilename}`)
      })
    },
  }

  const saveModuleContent = (moduleUrl, value) => {
    moduleContentMap[
      potentialServerUrlToUrl(moduleUrl, { compileServerOrigin, projectDirectoryUrl })
    ] = value
  }

  const loadModule = async (moduleUrl) => {
    const { responseUrl, contentType, content } = await getModule(moduleUrl)

    if (contentType === "application/javascript") {
      const map = await fetchSourcemap({
        cancellationToken,
        logger,
        moduleUrl,
        moduleContent: content,
      })
      return {
        responseUrl,
        contentRaw: content,
        content,
        map,
      }
    }

    if (contentType === "application/json") {
      return {
        responseUrl,
        contentRaw: content,
        content: jsonToJavascript(content),
      }
    }

    if (contentType === "text/html") {
      return {
        responseUrl,
        contentRaw: content,
        content: htmlToJavascript(content),
      }
    }

    if (contentType === "text/css") {
      return {
        responseUrl,
        contentRaw: content,
        content: cssToJavascript(content),
      }
    }

    if (!contentType.startsWith("text/")) {
      logger.warn(`unexpected content-type for module.
--- content-type ---
${contentType}
--- expected content-types ---
"application/javascript"
"application/json"
"text/*"
--- module url ---
${moduleUrl}`)
    }

    // fallback to text
    return {
      responseUrl,
      contentRaw: content,
      content: textToJavascript(content),
    }
  }

  const jsonToJavascript = (jsonString) => {
    // there is no need to minify the json string
    // because it becomes valid javascript
    // that will be minified by minifyJs inside renderChunk
    return `export default ${jsonString}`
  }

  const htmlToJavascript = (htmlString) => {
    if (minify) {
      htmlString = minifyHtml(htmlString, minifyHtmlOptions)
    }
    return `export default ${JSON.stringify(htmlString)}`
  }

  const cssToJavascript = (cssString) => {
    if (minify) {
      cssString = minifyCss(cssString, minifyCssOptions)
    }
    return `export default ${JSON.stringify(cssString)}`
  }

  const textToJavascript = (textString) => {
    return `export default ${JSON.stringify(textString)}`
  }

  const getModule = async (moduleUrl) => {
    const response = await fetchUrl(moduleUrl, { cancellationToken })
    const okValidation = validateResponseStatusIsOk(response)

    if (!okValidation.valid) {
      throw new Error(okValidation.message)
    }

    return {
      responseUrl: response.url,
      contentType: response.headers["content-type"],
      content: response.body,
    }
  }

  return {
    jsenvRollupPlugin,
    getExtraInfo: () => {
      return {
        moduleContentMap,
      }
    },
  }
}

// const urlToRollupId = (url, { compileServerOrigin, projectDirectoryUrl }) => {
//   if (url.startsWith(`${compileServerOrigin}/`)) {
//     return urlToFilePath(`${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`)
//   }
//   if (url.startsWith("file://")) {
//     return urlToFilePath(url)
//   }
//   return url
// }

// const urlToServerUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
//   if (url.startsWith(projectDirectoryUrl)) {
//     return `${compileServerOrigin}/${url.slice(projectDirectoryUrl.length)}`
//   }
//   return null
// }

const potentialServerUrlToUrl = (url, { compileServerOrigin, projectDirectoryUrl }) => {
  if (url.startsWith(`${compileServerOrigin}/`)) {
    return `${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`
  }
  return url
}

// const rollupIdToFileServerUrl = (rollupId, { projectDirectoryUrl, compileServerOrigin }) => {
//   const fileUrl = rollupIdToFileUrl(rollupId)
//   if (!fileUrl) {
//     return null
//   }

//   if (!fileUrl.startsWith(projectDirectoryUrl)) {
//     return null
//   }

//   const fileRelativeUrl = urlToRelativeUrl(fileUrl, projectDirectoryUrl)
//   return `${compileServerOrigin}/${fileRelativeUrl}`
// }

const transformAsyncInsertedByRollup = async ({
  projectDirectoryUrl,
  bundleDirectoryUrl,
  babelPluginMap,
  bundle,
}) => {
  const asyncPluginName = findAsyncPluginNameInBabelPluginMap(babelPluginMap)

  if (!asyncPluginName) return

  // we have to do this because rollup ads
  // an async wrapper function without transpiling it
  // if your bundle contains a dynamic import
  await Promise.all(
    Object.keys(bundle).map(async (bundleFilename) => {
      const bundleInfo = bundle[bundleFilename]

      const { code, map } = await transformJs({
        projectDirectoryUrl,
        code: bundleInfo.code,
        url: filePathToUrl(bundleFilename),
        map: bundleInfo.map,
        babelPluginMap: { [asyncPluginName]: babelPluginMap[asyncPluginName] },
        transformModuleIntoSystemFormat: false, // already done by rollup
        transformGenerator: false, // already done
        transformGlobalThis: false,
      })

      const bundleFileUrl = resolveUrl(bundleFilename, bundleDirectoryUrl)

      await Promise.all([
        writeFileContent(
          urlToFilePath(bundleFileUrl),
          writeSourceMappingURL(code, `./${bundleFilename}.map`),
        ),
        writeFileContent(urlToFilePath(`${bundleFileUrl}.map`), JSON.stringify(map)),
      ])
    }),
  )
}
