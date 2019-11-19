/* eslint-disable import/max-dependencies */
import { urlToContentType } from "@jsenv/server"
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
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { transformJs } from "internal/compiling/js-compilation-service/transformJs.js"
import { findAsyncPluginNameInBabelPluginMap } from "internal/compiling/js-compilation-service/findAsyncPluginNameInBabelPluginMap.js"

import { generateBabelPluginMapOption } from "../../generateBabelPluginMapOption/generateBabelPluginMapOption.js"
import { fetchUrl } from "./fetchUrl.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { validateResponseStatusIsOk } from "./validateResponseStatusIsOk.js"

const { minify: minifyCode } = import.meta.require("terser")

export const createJsenvRollupPlugin = async ({
  cancellationToken,
  logger,
  compileServerLogLevel,
  projectDirectoryUrl,
  bundleDirectoryUrl,
  importMapFileUrl,
  importDefaultExtension,
  importReplaceMap,
  importFallbackMap,
  // bundleCache,
  // bundleCacheDirectoryRelativePath,
  babelPluginMap,
  babelPluginRequiredNameArray,
  convertMap,
  minify,
  format,
  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global",
  entryPointMap,
}) => {
  const arrayOfUrlToSkipTransform = []
  const arrayOfAbstractUrl = []
  const moduleContentMap = {}

  const bundleConstantAbstractSpecifier = "/.jsenv/BUNDLE_CONSTANTS.js"

  babelPluginMap = generateBabelPluginMapOption({
    format,
    babelPluginMap,
    babelPluginRequiredNameArray,
  })

  const chunkId = `${Object.keys(entryPointMap)[0]}.js`
  importReplaceMap = {
    [bundleConstantAbstractSpecifier]: () => `export const chunkId = ${JSON.stringify(chunkId)}`,
    ...importReplaceMap,
  }

  const compileDirectoryUrl = `${bundleDirectoryUrl}.dist/`

  const {
    origin: compileServerOrigin,
    importMap: compileServerImportMap,
  } = await startCompileServer({
    cancellationToken,
    logLevel: compileServerLogLevel,
    projectDirectoryUrl,
    importMapFileUrl,
    importDefaultExtension,
    importReplaceMap,
    importFallbackMap,
    compileDirectoryUrl,
    writeOnFilesystem: true,
    useFilesystemAsCache: true,
    babelPluginMap,
    convertMap,
    transformModuleIntoSystemFormat: false, // will be done by rollup
    // what about compileGroupCount, well let's assume 1 for now

    // we will always compile for one group which is the one
    // with everything inside babelPluginMap
    compileGroupCount: 1,
  })

  const compileDirectoryServerUrl = `${compileServerOrigin}/${urlToRelativeUrl(
    compileDirectoryUrl,
    projectDirectoryUrl,
  )}`
  const compileGroupDirectoryServerUrl = `${compileDirectoryServerUrl}otherwise/`
  const importMap = normalizeImportMap(compileServerImportMap, compileGroupDirectoryServerUrl)

  const jsenvRollupPlugin = {
    name: "jsenv",

    resolveId: (specifier, importer = compileGroupDirectoryServerUrl) => {
      if (!hasScheme(importer)) {
        importer = pathToFileUrl(importer)
      }

      const importUrl = resolveImport({
        specifier,
        importer,
        importMap,
        defaultExtension: importDefaultExtension,
      })
      logger.debug(`resolve ${specifier} to ${importUrl}`)
      return importUrl
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {

    // },

    load: async (rollupId) => {
      const url = rollupIdToUrl(rollupId)
      logger.debug(`loading ${url}`)
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
      // we want something like ../../../../file.js to become /file.js
      // and also rollup does not expects to have http dependency in the mix

      const chunkFileUrl = resolveFileUrl(`./${chunkId}`, bundleDirectoryUrl)

      const relativePathToUrl = (relativePath) => {
        const url = resolveFileUrl(relativePath, chunkFileUrl)

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
          relativePath = fileUrlToRelativePath(fileUrl, chunkFileUrl)
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

  const markUrlAsAbstract = (url) => {
    if (!arrayOfAbstractUrl.includes(url)) {
      arrayOfAbstractUrl.push(url)
    }
  }

  const loadModule = async (moduleUrl) => {
    const { contentType, content, map } = await getModule(moduleUrl)

    if (contentType === "application/javascript") {
      return {
        contentRaw: content,
        content,
        map: await fetchSourcemap({
          cancellationToken,
          logger,
          moduleUrl,
          moduleContent: content,
        }),
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
    if (moduleUrl in importReplaceMap) {
      const generateSourceForImport = importReplaceMap[moduleUrl]
      if (typeof generateSourceForImport !== "function") {
        throw new Error(
          `specifierAbstractMap values must be functions, found ${generateSourceForImport} for ${moduleUrl}`,
        )
      }

      return generateAbstractModuleForImport(moduleUrl, generateSourceForImport)
    }

    const response = await fetchUrl(moduleUrl, { cancellationToken })
    const okValidation = validateResponseStatusIsOk(response)

    if (!okValidation.valid) {
      if (response.status === 404 && moduleUrl in importFallbackMap) {
        return generateAbstractModuleForImport(moduleUrl, importFallbackMap[moduleUrl])
      }
      throw new Error(okValidation.message)
    }

    return {
      contentType: response.headers["content-type"],
      content: response.body,
    }
  }

  const generateAbstractModuleForImport = async (url, generateSource) => {
    markUrlAsAbstract(url)

    const returnValue = await generateSource()
    const result = typeof returnValue === "string" ? { code: returnValue } : returnValue

    const { skipTransform, code, map } = result

    if (skipTransform) {
      arrayOfUrlToSkipTransform.push(url)
    }

    return {
      contentType: urlToContentType(url),
      content: code,
      map,
    }
  }

  return {
    jsenvRollupPlugin,
    getExtraInfo: () => {
      return {
        arrayOfAbstractUrl,
        moduleContentMap,
      }
    },
  }
}

export const rollupIdToUrl = (rollupId) => {
  if (hasScheme(rollupId)) {
    return rollupId
  }

  return pathToFileUrl(rollupId)
}

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
