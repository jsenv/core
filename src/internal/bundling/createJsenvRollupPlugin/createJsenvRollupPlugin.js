/* eslint-disable import/max-dependencies */
import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import {
  urlToRelativeUrl,
  hasScheme,
  fileUrlToPath,
  pathToFileUrl,
  resolveFileUrl,
  fileUrlToRelativePath,
} from "internal/urlUtils.js"
import { writeFileContent } from "internal/filesystemUtils.js"
import { writeSourceMappingURL } from "internal/sourceMappingURLUtils.js"
import { transformJs } from "internal/compiling/js-compilation-service/transformJs.js"
import { findAsyncPluginNameInBabelPluginMap } from "internal/compiling/js-compilation-service/findAsyncPluginNameInBabelPluginMap.js"

import { fetchUrl } from "./fetchUrl.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { validateResponseStatusIsOk } from "./validateResponseStatusIsOk.js"

const { minify: minifyCode } = import.meta.require("terser")

export const createJsenvRollupPlugin = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  entryPointMap,
  bundleDirectoryUrl,
  importDefaultExtension,

  compileServerOrigin,
  compileServerImportMap,
  compileDirectoryServerUrl,
  babelPluginMap,

  minify,
  format,
  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global",
}) => {
  const moduleContentMap = {}
  const chunkId = `${Object.keys(entryPointMap)[0]}.js`
  const importMap = normalizeImportMap(compileServerImportMap, compileDirectoryServerUrl)

  const jsenvRollupPlugin = {
    name: "jsenv",

    resolveId: (specifier, importer = compileDirectoryServerUrl) => {
      if (!hasScheme(importer)) {
        importer = pathToFileUrl(importer)
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
      const { contentRaw, content, map } = await loadModule(url)

      moduleContentMap[url] = {
        content,
        contentRaw,
      }

      return { code: content, map }
    },

    // resolveImportMeta: () => {}

    // transform should not be required anymore as
    // we will receive
    // transform: async (moduleContent, rollupId) => {}

    outputOptions: (options) => {
      // rollup does not expects to have http dependency in the mix
      // and relativize then cause they are files behind the scene

      const bundleSourcemapFileUrl = resolveFileUrl(`./${chunkId}.map`, bundleDirectoryUrl)

      const relativePathToUrl = (relativePath) => {
        const url = resolveFileUrl(relativePath, bundleSourcemapFileUrl)

        // fix rollup not supporting source being http
        if (url.startsWith(projectDirectoryUrl)) {
          const relativeUrl = urlToRelativeUrl(url, projectDirectoryUrl)
          if (relativeUrl.startsWith("http:/")) {
            return `http://${relativeUrl.slice(`http:/`.length)}`
          }
          if (relativeUrl.startsWith("https:/")) {
            return `https://${relativeUrl.slice(`https:/`.length)}`
          }
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

  const loadModule = async (moduleUrl) => {
    const { contentType, content, map } = await getModule(moduleUrl)

    if (contentType === "application/javascript") {
      const map = await fetchSourcemap({
        cancellationToken,
        logger,
        moduleUrl,
        moduleContent: content,
      })
      return {
        contentRaw: content,
        content,
        map,
      }
    }

    if (contentType === "application/json") {
      return {
        contentRaw: content,
        content: `export default ${content}`,
        map,
      }
    }

    if (contentType.startsWith("text/")) {
      return {
        contentRaw: content,
        content: `export default ${JSON.stringify(content)}`,
        map,
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
      contentRaw: content,
      // fallback to text
      content: `export default ${JSON.stringify(content)}`,
      map,
    }
  }

  const getModule = async (moduleUrl) => {
    const response = await fetchUrl(moduleUrl, { cancellationToken })
    const okValidation = validateResponseStatusIsOk(response)

    if (!okValidation.valid) {
      throw new Error(okValidation.message)
    }

    return {
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

export const rollupIdToUrl = (rollupId) => {
  if (hasScheme(rollupId)) {
    return rollupId
  }
  const fileUrl = pathToFileUrl(rollupId)
  return fileUrl
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

// export const rollupIdToUrl = (rollupId, { compileServerOrigin, projectDirectoryUrl }) => {
//   if (hasScheme(rollupId)) {
//     if (rollupId.startsWith(`${compileServerOrigin}/`)) {
//       return `${projectDirectoryUrl}${rollupId.slice(`${compileServerOrigin}/`.length)}`
//     }
//     return rollupId
//   }

//   return pathToFileUrl(rollupId)
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
        url: pathToFileUrl(bundleFilename),
        map: bundleInfo.map,
        babelPluginMap: { [asyncPluginName]: babelPluginMap[asyncPluginName] },
        transformModuleIntoSystemFormat: false, // already done by rollup
        transformGenerator: false, // already done
      })

      const bundleFileUrl = resolveFileUrl(bundleFilename, bundleDirectoryUrl)

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
