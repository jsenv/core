/**
 * a faire
 *
 * - inline js in html
 * - link css in html
 * - inline css in html
 * - tester un aset remap avec importmap
 * - recevoir un systemJsScriptRelativeUrl qu'on ajoutera
 * au html lorsque le bundle est de type systemjs
 * (on le mettra inline)
 * et que si la page html contient une balise script
 * - a warning about some node in html
 * we must have the source from extractSourceLocation properly shown
 * test also a syntax error in html
 * - a warning about some node in css
 * one with @import, one with url()
 * a css syntax error to see how it goes
 */

/* eslint-disable import/max-dependencies */
import { extname } from "path"
import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import {
  isFileSystemPath,
  fileSystemPathToUrl,
  resolveUrl,
  urlToRelativeUrl,
  resolveDirectoryUrl,
  writeFile,
  comparePathnames,
  urlIsInsideOf,
} from "@jsenv/util"

import { setJavaScriptSourceMappingUrl } from "../../sourceMappingURLUtils.js"
import { fetchUrl } from "../../fetchUrl.js"
import { validateResponseStatusIsOk } from "../../validateResponseStatusIsOk.js"
import { transformJs } from "../../compiling/js-compilation-service/transformJs.js"
import { findAsyncPluginNameInBabelPluginMap } from "../../compiling/js-compilation-service/findAsyncPluginNameInBabelPluginMap.js"

import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { minifyHtml } from "./minifyHtml.js"
import { minifyJs } from "./minifyJs.js"
import { minifyCss } from "./minifyCss.js"
import { createCompositeAssetHandler } from "./compositeAsset.js"
import { jsenvCompositeAssetHooks } from "./jsenvCompositeAssetHooks.js"

const STATIC_COMPILE_SERVER_AUTHORITY = "//jsenv.com"

export const createJsenvRollupPlugin = async ({
  cancellationToken,
  logger,

  projectDirectoryUrl,
  entryPointMap,
  bundleDirectoryUrl,
  bundleDefaultExtension,
  importMapFileRelativeUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  importDefaultExtension,

  externalImportSpecifiers,
  node,
  browser,
  babelPluginMap,
  format,
  minify,
  // https://github.com/terser/terser#minify-options
  minifyJsOptions,
  // https://github.com/jakubpawlowicz/clean-css#constructor-options
  minifyCssOptions,
  // https://github.com/kangax/html-minifier#options-quick-reference
  minifyHtmlOptions,
  manifestFile,
  // systemJsFileUrl = "/node_modules/systemjs/dist/s.min.js",

  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global",
}) => {
  const moduleContentMap = {}
  const redirectionMap = {}

  let chunkId = Object.keys(entryPointMap)[0]
  if (!extname(chunkId)) chunkId += bundleDefaultExtension

  const compileDirectoryUrl = resolveDirectoryUrl(compileDirectoryRelativeUrl, projectDirectoryUrl)
  const compileDirectoryRemoteUrl = resolveDirectoryUrl(
    compileDirectoryRelativeUrl,
    compileServerOrigin,
  )
  const importMapFileRemoteUrl = resolveUrl(importMapFileRelativeUrl, compileDirectoryRemoteUrl)
  const importMapFileResponse = await fetchUrl(importMapFileRemoteUrl)
  const importMapRaw = await importMapFileResponse.json()
  logger.debug(`importmap file fetched from ${importMapFileRemoteUrl}`)

  // use a fake and predictable compile server origin
  // because rollup will check the dependencies url
  // when computing the file hash
  // see https://github.com/rollup/rollup/blob/d6131378f9481a442aeaa6d4e608faf3303366dc/src/Chunk.ts#L795
  // this way file hash remains the same when file content does not change
  const compileServerOriginForRollup = String(
    new URL(STATIC_COMPILE_SERVER_AUTHORITY, compileServerOrigin),
  ).slice(0, -1)
  const compileDirectoryRemoteUrlForRollup = resolveDirectoryUrl(
    compileDirectoryRelativeUrl,
    compileServerOriginForRollup,
  )
  const importMapFileRemoteUrlForRollup = resolveUrl(
    importMapFileRelativeUrl,
    compileDirectoryRemoteUrlForRollup,
  )
  const importMap = normalizeImportMap(importMapRaw, importMapFileRemoteUrlForRollup)

  const nativeModulePredicate = (specifier) => {
    if (node && isBareSpecifierForNativeNodeModule(specifier)) return true
    // for now browser have no native module
    // and we don't know how we will handle that
    if (browser) return false
    return false
  }

  const importerMapping = {}
  const virtualModules = {}

  let compositeAssetHandler
  let emitFile = () => {}
  const jsenvRollupPlugin = {
    name: "jsenv",

    async buildStart() {
      emitFile = (...args) => this.emitFile(...args)
      compositeAssetHandler = createCompositeAssetHandler(
        {
          ...jsenvCompositeAssetHooks,
          load: async (url) => {
            const moduleResponse = await fetchModule(url)
            // const contentType = moduleResponse.headers["content-type"] || ""
            const responseBodyAsArrayBuffer = await moduleResponse.arrayBuffer()
            return Buffer.from(responseBodyAsArrayBuffer)
          },
        },
        {
          projectDirectoryUrl,
          connectReference: (reference) => {
            // ignore url outside project directory
            // a better version would console.warn about file url outside projectDirectoryUrl
            // and ignore them and console.info/debug about remote url (https, http, ...)
            if (!urlIsInsideOf(reference.url, projectDirectoryUrl)) {
              return { external: true }
            }

            if (reference.type === "asset") {
              reference.connect(async () => {
                await reference.getFileNameReadyPromise()
                const { sourceAfterTransformation, fileNameForRollup, map } = reference

                if (map) {
                  const mapFileName = `${fileNameForRollup}.map`
                  logger.debug(`emit asset for ${mapFileName}`)
                  const mapFileUrl = resolveUrl(mapFileName, bundleDirectoryUrl)
                  map.sources = map.sources.map((source) => {
                    const sourceUrl = resolveUrl(source, reference.url)
                    const sourceUrlRelativeToSourceMap = urlToRelativeUrl(sourceUrl, mapFileUrl)
                    return sourceUrlRelativeToSourceMap
                  })
                  emitFile({
                    type: "asset",
                    source: JSON.stringify(map, null, "  "),
                    fileName: mapFileName,
                  })
                }

                logger.debug(`emit asset for ${shortenUrl(reference.url)}`)
                const rollupReferenceId = emitFile({
                  type: "asset",
                  source: sourceAfterTransformation,
                  fileName: fileNameForRollup,
                })
                logger.debug(`${shortenUrl(reference.url)} ready -> ${fileNameForRollup}`)
                return { rollupReferenceId }
              })
            }

            if (reference.type === "js") {
              reference.connect(async () => {
                const jsRelativeUrl = `./${urlToRelativeUrl(reference.url, projectDirectoryUrl)}`
                const id = jsRelativeUrl
                if (typeof reference.source !== "undefined") {
                  virtualModules[id] = reference.source
                }

                logger.debug(`emit chunk for ${shortenUrl(reference.url)}`)
                const rollupReferenceId = emitFile({
                  type: "chunk",
                  id,
                  ...(reference.previousJsReference
                    ? {
                        implicitlyLoadedAfterOneOf: [
                          `./${urlToRelativeUrl(
                            reference.previousJsReference.url,
                            projectDirectoryUrl,
                          )}`,
                        ],
                      }
                    : {}),
                })

                return { rollupReferenceId }
              })
            }

            return null
          },
        },
      )

      // https://github.com/easesu/rollup-plugin-html-input/blob/master/index.js
      // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
      await Promise.all(
        Object.keys(entryPointMap).map(async (key) => {
          const chunkFileRelativeUrl = entryPointMap[key]
          const chunkFileUrl = resolveUrl(chunkFileRelativeUrl, projectDirectoryUrl)
          // const chunkBundledFileUrl = resolveUrl(chunkFileRelativeUrl, bundleDirectoryUrl)

          if (!chunkFileRelativeUrl.endsWith(".html")) {
            this.emitFile({
              type: "chunk",
              id: chunkFileRelativeUrl,
              fileName: `${key}${bundleDefaultExtension || extname(chunkFileRelativeUrl)}`,
            })
            return
          }

          await compositeAssetHandler.prepareAssetEntry(chunkFileUrl, {
            fileNameForRollup: key.endsWith(".html") ? key : `${key}.html`,
          })
        }),
      )
    },

    resolveId(specifier, importer) {
      if (importer === undefined) {
        if (specifier.endsWith(".html")) {
          importer = compileServerOriginForRollup
        } else {
          importer = compileDirectoryRemoteUrlForRollup
        }
      }

      if (nativeModulePredicate(specifier)) {
        logger.debug(`${specifier} is native module -> marked as external`)
        return false
      }

      if (externalImportSpecifiers.includes(specifier)) {
        logger.debug(`${specifier} verifies externalImportSpecifiers -> marked as external`)
        return { id: specifier, external: true }
      }

      if (virtualModules.hasOwnProperty(specifier)) {
        return specifier
      }

      if (isFileSystemPath(importer)) {
        importer = fileSystemPathToUrl(importer)
      }
      const importUrl = resolveImport({
        specifier,
        importer,
        importMap,
        defaultExtension: importDefaultExtension,
      })

      if (importer !== projectDirectoryUrl) {
        importerMapping[importUrl] = importer
      }

      // keep external url intact
      if (!urlIsInsideOf(importUrl, compileServerOrigin)) {
        return { id: specifier, external: true }
      }

      // const rollupId = urlToRollupId(importUrl, { projectDirectoryUrl, compileServerOrigin })
      logger.debug(`${specifier} imported by ${importer} resolved to ${importUrl}`)
      return importUrl
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {

    // },

    async load(urlForRollup) {
      const moduleInfo = this.getModuleInfo(urlForRollup)
      const remoteUrl = urlToRemoteUrl(urlForRollup)
      const url = remoteUrl || urlForRollup

      logger.debug(`loads ${url}`)
      const { responseUrl, contentRaw, content = "", map } = await loadModule(
        url,
        moduleInfo,
        async (assetFileContent) => {
          if (!remoteUrl) {
            throw new Error(`${url} cannot emit asset`)
          }

          const sourceFileUrl = urlToSourceFileUrl(remoteUrl)
          if (!sourceFileUrl) {
            throw new Error(`a file outside project cannot emit an asset.
--- file url ---
${url}
--- project directory url ---
${projectDirectoryUrl}`)
          }

          const assetReferenceId = await compositeAssetHandler.getAssetReferenceIdForRollup(
            urlForRollup,
            {
              source: assetFileContent,
              importerUrl: importerMapping[urlForRollup],
            },
          )
          return assetReferenceId
        },
      )

      const responseUrlForRollup = urlToRollupUrl(responseUrl) || responseUrl
      saveModuleContent(responseUrlForRollup, {
        content,
        contentRaw,
      })
      // handle redirection
      if (responseUrlForRollup !== urlForRollup) {
        saveModuleContent(urlForRollup, {
          content,
          contentRaw,
        })
        redirectionMap[urlForRollup] = responseUrlForRollup
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

      options.sourcemapPathTransform = (relativePath) => {
        const url = relativePathToUrlForRollup(relativePath)

        if (url.startsWith(`${compileServerOriginForRollup}/`)) {
          const relativeUrl = url.slice(`${compileServerOriginForRollup}/`.length)
          const fileUrl = `${projectDirectoryUrl}${relativeUrl}`
          relativePath = urlToRelativeUrl(fileUrl, bundleSourcemapFileUrl)
          return relativePath
        }
        if (url.startsWith(projectDirectoryUrl)) {
          return relativePath
        }

        return url
      }

      const relativePathToUrlForRollup = (relativePath) => {
        const rollupUrl = resolveUrl(relativePath, bundleSourcemapFileUrl)
        let url

        // fix rollup not supporting source being http
        const httpIndex = rollupUrl.indexOf(`http:/`)
        if (httpIndex > -1) {
          url = `http://${rollupUrl.slice(httpIndex + `http:/`.length)}`
        } else {
          const httpsIndex = rollupUrl.indexOf("https:/")
          if (httpsIndex > -1) {
            url = `https://${rollupUrl.slice(httpsIndex + `https:/`.length)}`
          } else {
            url = rollupUrl
          }
        }

        if (url in redirectionMap) {
          return redirectionMap[url]
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

    async generateBundle(outputOptions, bundle) {
      logger.info(formatBundleGeneratedLog(bundle))

      if (manifestFile) {
        const mappings = {}
        Object.keys(bundle).forEach((key) => {
          const chunk = bundle[key]
          let chunkId = chunk.name
          chunkId += ".js"
          mappings[chunkId] = chunk.fileName
        })
        const mappingKeysSorted = Object.keys(mappings).sort(comparePathnames)
        const manifest = {}
        mappingKeysSorted.forEach((key) => {
          manifest[key] = mappings[key]
        })

        const manifestFileUrl = resolveUrl("manifest.json", bundleDirectoryUrl)
        await writeFile(manifestFileUrl, JSON.stringify(manifest, null, "  "))
      }
    },

    // ptet transformer ceci en renderChunk
    async writeBundle(options, bundle) {
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

  // take any url string and return url used for rollup
  const urlToRollupUrl = (url) => {
    if (url.startsWith(`${compileServerOriginForRollup}/`)) {
      return url
    }

    const remoteUrl = urlToRemoteUrl(url)
    if (!remoteUrl) {
      return null
    }

    return `${compileServerOriginForRollup}/${url.slice(`${compileServerOrigin}/`.length)}`
  }

  // take any url string and try to return a file url (an url inside projectDirectoryUrl)
  const urlToFileUrl = (url) => {
    if (url.startsWith(`${projectDirectoryUrl}/`)) {
      return url
    }

    if (url.startsWith(`${compileServerOrigin}/`)) {
      return `${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`
    }

    if (url.startsWith(`${compileServerOriginForRollup}/`)) {
      return `${projectDirectoryUrl}${url.slice(`${compileServerOriginForRollup}/`.length)}`
    }

    return null
  }

  // take any url string and try to return the corresponding remote url (an url inside compileServerOrigin)
  const urlToRemoteUrl = (url) => {
    if (url.startsWith(`${compileServerOrigin}/`)) {
      return url
    }

    if (url.startsWith(`${compileServerOriginForRollup}/`)) {
      return `${compileServerOrigin}/${url.slice(`${compileServerOriginForRollup}/`.length)}`
    }

    if (url.startsWith(`${projectDirectoryUrl}/`)) {
      return `${compileServerOrigin}/${url.slice(`${projectDirectoryUrl}/`.length)}`
    }

    return null
  }

  // take any url string and try to return a file url inside project directory url
  // prefer the source url if the url is inside compile directory
  const urlToSourceFileUrl = (url) => {
    const fileUrl = urlToFileUrl(url)
    if (!fileUrl) {
      return null
    }

    if (!urlIsInsideOf(fileUrl, compileDirectoryUrl)) {
      return fileUrl
    }

    const relativeUrl = urlToRelativeUrl(fileUrl, compileDirectoryUrl)
    return resolveUrl(relativeUrl, projectDirectoryUrl)
  }

  const saveModuleContent = (moduleUrl, value) => {
    const remoteUrl = urlToRemoteUrl(moduleUrl)
    const url = urlToFileUrl(remoteUrl || moduleUrl) || moduleUrl
    moduleContentMap[url] = value
  }

  const loadModule = async (moduleUrl, moduleInfo, emitAsset) => {
    if (moduleUrl in virtualModules) {
      const codeInput = virtualModules[moduleUrl]

      const { code, map } = await transformJs({
        projectDirectoryUrl,
        code: codeInput,
        url: moduleUrl,
        babelPluginMap,
      })

      return {
        responseUrl: moduleUrl,
        contentRaw: code,
        content: code,
        map,
      }
    }

    const moduleResponse = await fetchModule(moduleUrl)
    const contentType = moduleResponse.headers["content-type"] || ""
    const moduleText = await moduleResponse.text()

    const commonData = {
      responseUrl: moduleResponse.url,
      contentRaw: moduleText,
    }

    // keep this in sync with module-registration.js
    if (contentType === "application/javascript" || contentType === "text/javascript") {
      return {
        ...commonData,
        content: moduleText,
        map: await fetchSourcemap({
          cancellationToken,
          logger,
          moduleUrl,
          moduleContent: moduleText,
        }),
      }
    }

    if (contentType === "application/json" || contentType === "application/importmap+json") {
      // there is no need to minify the json string
      // because it becomes valid javascript
      // that will be minified by minifyJs inside renderChunk
      const jsonString = moduleText
      return {
        ...commonData,
        content: `export default ${jsonString}`,
      }
    }

    if (contentType === "text/html") {
      if (moduleInfo.isEntry) {
        return {
          content: "",
        }
      }

      const htmlString = minify ? minifyHtml(htmlString, minifyHtmlOptions) : moduleText
      const referenceId = await emitAsset(htmlString)
      return {
        ...commonData,
        content: `export default import.meta.ROLLUP_FILE_URL_${referenceId};`,
      }
    }

    if (contentType === "text/css") {
      const cssString = minify ? minifyCss(moduleText, minifyCssOptions) : moduleText
      const referenceId = await emitAsset(cssString)
      return {
        ...commonData,
        content: `export default import.meta.ROLLUP_FILE_URL_${referenceId};`,
      }
    }

    if (contentType === "image/svg+xml") {
      // could also benefit of minification https://github.com/svg/svgo
      const svgString = moduleText
      const referenceId = await emitAsset(svgString)
      return {
        ...commonData,
        content: `export default import.meta.ROLLUP_FILE_URL_${referenceId};`,
      }
    }

    if (contentType.startsWith("text/")) {
      const textString = moduleText
      const referenceId = await emitAsset(textString)
      return {
        ...commonData,
        content: `export default import.meta.ROLLUP_FILE_URL_${referenceId};`,
      }
    }

    logger.debug(`Using buffer to bundle module because of its content-type.
--- content-type ---
${contentType}
--- module url ---
${moduleUrl}`)
    const referenceId = await emitAsset(Buffer.from(moduleText))
    return {
      ...commonData,
      content: `export default import.meta.ROLLUP_FILE_URL_${referenceId};`,
    }
  }

  const fetchModule = async (moduleUrl) => {
    const response = await fetchUrl(moduleUrl, {
      cancellationToken,
      ignoreHttpsError: true,
    })
    const okValidation = validateResponseStatusIsOk(response)

    if (!okValidation.valid) {
      throw new Error(okValidation.message)
    }

    return response
  }

  const shortenUrl = (url) => {
    return urlIsInsideOf(url, projectDirectoryUrl)
      ? urlToRelativeUrl(url, projectDirectoryUrl)
      : url
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
//     return urlToFileSystemPath(`${projectDirectoryUrl}${url.slice(`${compileServerOrigin}/`.length)}`)
//   }
//   if (url.startsWith("file://")) {
//     return urlToFileSystemPath(url)
//   }
//   return url
// }

// const urlToServerUrl = (url, { projectDirectoryUrl, compileServerOrigin }) => {
//   if (url.startsWith(projectDirectoryUrl)) {
//     return `${compileServerOrigin}/${url.slice(projectDirectoryUrl.length)}`
//   }
//   return null
// }

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
      const bundleFileUrl = resolveUrl(bundleFilename, bundleDirectoryUrl)

      const { code, map } = await transformJs({
        projectDirectoryUrl,
        code: bundleInfo.code,
        url: bundleFileUrl,
        map: bundleInfo.map,
        babelPluginMap: { [asyncPluginName]: babelPluginMap[asyncPluginName] },
        transformModuleIntoSystemFormat: false, // already done by rollup
        transformGenerator: false, // already done
        transformGlobalThis: false,
      })

      await Promise.all([
        writeFile(bundleFileUrl, setJavaScriptSourceMappingUrl(code, `./${bundleFilename}.map`)),
        writeFile(`${bundleFileUrl}.map`, JSON.stringify(map)),
      ])
    }),
  )
}

const formatBundleGeneratedLog = (bundle) => {
  const assetFilenames = Object.keys(bundle)
    .filter((key) => bundle[key].type === "asset")
    .map((key) => bundle[key].fileName)
  const assetCount = assetFilenames.length

  const chunkFilenames = Object.keys(bundle)
    .filter((key) => bundle[key].type === "chunk")
    .map((key) => bundle[key].fileName)
  const chunkCount = chunkFilenames.length

  const assetDescription =
    // eslint-disable-next-line no-nested-ternary
    assetCount === 0 ? "" : assetCount === 1 ? "1 asset" : `${assetCount} assets`
  const chunkDescription =
    // eslint-disable-next-line no-nested-ternary
    chunkCount === 0 ? "" : chunkCount === 1 ? "1 chunk" : `${chunkCount} chunks`

  return createDetailedMessage(`bundle generated`, {
    ...(assetDescription ? { [assetDescription]: assetFilenames } : {}),
    ...(chunkDescription ? { [chunkDescription]: chunkFilenames } : {}),
  })
}

const createDetailedMessage = (message, details = {}) => {
  let string = `${message}`

  Object.keys(details).forEach((key) => {
    const value = details[key]
    string += `
--- ${key} ---
${
  Array.isArray(value)
    ? value.join(`
`)
    : value
}`
  })

  return string
}
