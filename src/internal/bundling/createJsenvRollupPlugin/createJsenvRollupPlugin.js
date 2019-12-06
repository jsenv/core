/* eslint-disable import/max-dependencies */
import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import {
  hasScheme,
  fileUrlToPath,
  filePathToUrl,
  resolveUrl,
  fileUrlToRelativePath,
  resolveDirectoryUrl,
} from "internal/urlUtils.js"
import { writeFileContent } from "internal/filesystemUtils.js"
import { writeSourceMappingURL } from "internal/sourceMappingURLUtils.js"
import { fetchUrl } from "internal/fetchUrl.js"
import { transformJs } from "internal/compiling/js-compilation-service/transformJs.js"
import { findAsyncPluginNameInBabelPluginMap } from "internal/compiling/js-compilation-service/findAsyncPluginNameInBabelPluginMap.js"

import { fetchSourcemap } from "./fetchSourcemap.js"
import { validateResponseStatusIsOk } from "./validateResponseStatusIsOk.js"

const { minify: minifyCode } = import.meta.require("terser")

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
      const minifyOptions = format === "global" ? { toplevel: false } : { toplevel: true }
      const result = minifyCode(source, {
        sourceMap: true,
        ...minifyOptions,
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
      // we could minify json too
      // et a propos du map qui pourrait permettre de connaitre la vrai source pour ce fichier
      // genre dire que la source c'est je ne sais quoi
      // a defaut il faudrait
      // pouvoir tenir compte d'une redirection pour update le
      return {
        responseUrl,
        contentRaw: content,
        content: `export default ${content}`,
      }
    }

    if (contentType.startsWith("text/")) {
      // we could minify html, svg, css etc too
      return {
        responseUrl,
        contentRaw: content,
        content: `export default ${JSON.stringify(content)}`,
      }
    }

    logger.warn(`unexpected content-type for module.
--- content-type ---
${contentType}
--- expected content-types ---
"application/javascript"
"application/json"
"text/*"
--- module url ---
${moduleUrl}`)

    return {
      responseUrl,
      contentRaw: content,
      // fallback to text
      content: `export default ${JSON.stringify(content)}`,
    }
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
//     return fileUrlToPath(`${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`)
//   }
//   if (url.startsWith("file://")) {
//     return fileUrlToPath(url)
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
          fileUrlToPath(bundleFileUrl),
          writeSourceMappingURL(code, `./${bundleFilename}.map`),
        ),
        writeFileContent(fileUrlToPath(`${bundleFileUrl}.map`), JSON.stringify(map)),
      ])
    }),
  )
}
