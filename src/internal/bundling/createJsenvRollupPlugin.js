/* eslint-disable import/max-dependencies */
import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import { loggerToLogLevel } from "@jsenv/logger"
import {
  isFileSystemPath,
  fileSystemPathToUrl,
  resolveUrl,
  urlToRelativeUrl,
  resolveDirectoryUrl,
  writeFile,
  comparePathnames,
  urlIsInsideOf,
  urlToFileSystemPath,
  urlToBasename,
} from "@jsenv/util"

import { setJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import { validateResponseStatusIsOk } from "@jsenv/core/src/internal/validateResponseStatusIsOk.js"
import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
import { findAsyncPluginNameInBabelPluginMap } from "@jsenv/core/src/internal/compiling/js-compilation-service/findAsyncPluginNameInBabelPluginMap.js"
import {
  parseHtmlString,
  htmlAstContains,
  htmlNodeIsScriptModule,
  manipulateHtmlAst,
  findFirstImportmapNode,
  getHtmlNodeLocation,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { showSourceLocation } from "./showSourceLocation.js"

import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { createCompositeAssetHandler } from "./compositeAsset.js"
import { getTargetAsBase64Url } from "./getTargetAsBase64Url.js"

import { parseHtmlAsset } from "./html/parseHtmlAsset.js"
import { parseImportmapAsset } from "./parseImportmapAsset.js"
import { parseSvgAsset } from "./html/parseSvgAsset.js"
import { parseCssAsset } from "./css/parseCssAsset.js"
import { parseJsAsset } from "./js/parseJsAsset.js"
import { minifyJs } from "./js/minifyJs.js"

// use a fake and predictable compile server origin
// because rollup will check the dependencies url
// when computing the file hash
// https://github.com/rollup/rollup/blob/d6131378f9481a442aeaa6d4e608faf3303366dc/src/Chunk.ts#L483
// this way file hash remains the same when file content does not change
const STATIC_COMPILE_SERVER_AUTHORITY = "//jsenv.com"

export const createJsenvRollupPlugin = async ({
  cancellationToken,
  logger,

  entryPointMap,
  projectDirectoryUrl,
  importMapFileRelativeUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  importDefaultExtension,
  externalImportSpecifiers,
  babelPluginMap,
  node,
  browser,

  format,
  systemJsUrl,
  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
  manifestFile,

  bundleDirectoryUrl,
  detectAndTransformIfNeededAsyncInsertedByRollup = format === "global",
}) => {
  const urlImporterMap = {}
  const urlResponseBodyMap = {}
  const virtualModules = {}
  const urlRedirectionMap = {}
  // map project relative urls to bundle file relative urls
  let bundleMappings = {}
  // map bundle relative urls to relative url without hashes
  let bundleManifest = {}
  let rollupBundle

  const compileServerOriginForRollup = String(
    new URL(STATIC_COMPILE_SERVER_AUTHORITY, compileServerOrigin),
  ).slice(0, -1)

  const EMPTY_CHUNK_URL = resolveUrl("__empty__", projectDirectoryUrl)

  const compileDirectoryUrl = resolveDirectoryUrl(compileDirectoryRelativeUrl, projectDirectoryUrl)
  const compileDirectoryRemoteUrl = resolveDirectoryUrl(
    compileDirectoryRelativeUrl,
    compileServerOrigin,
  )

  const nativeModulePredicate = (specifier) => {
    if (node && isBareSpecifierForNativeNodeModule(specifier)) return true
    // for now browser have no native module
    // and we don't know how we will handle that
    if (browser) return false
    return false
  }

  const fetchImportmapFromParameter = async () => {
    const importmapProjectUrl = resolveUrl(importMapFileRelativeUrl, projectDirectoryUrl)
    const importMapFileCompiledUrl = resolveUrl(importMapFileRelativeUrl, compileDirectoryRemoteUrl)
    const importMap = await fetchAndNormalizeImportmap(importMapFileCompiledUrl, { allow404: true })
    if (importMap === null) {
      logger.warn(
        `WARNING: no importmap found following importMapRelativeUrl at ${importmapProjectUrl}`,
      )
      return {}
    }
    logger.debug(`use importmap found following importMapRelativeUrl at ${importmapProjectUrl}`)
    return importMap
  }

  let compositeAssetHandler
  let emitFile = () => {}
  let fetchImportmap = fetchImportmapFromParameter
  let importMap
  const jsenvRollupPlugin = {
    name: "jsenv",

    async buildStart() {
      emitFile = (...args) => this.emitFile(...args)

      // https://github.com/easesu/rollup-plugin-html-input/blob/master/index.js
      // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string

      const entryPointsPrepared = []
      await Promise.all(
        Object.keys(entryPointMap).map(async (key) => {
          const projectRelativeUrl = key
          const chunkFileRelativeUrl = entryPointMap[key]
          const chunkFileUrl = resolveUrl(chunkFileRelativeUrl, bundleDirectoryUrl)
          const chunkName = urlToRelativeUrl(chunkFileUrl, bundleDirectoryUrl)

          if (projectRelativeUrl.endsWith(".html")) {
            const htmlProjectUrl = resolveUrl(projectRelativeUrl, projectDirectoryUrl)
            const htmlServerUrl = resolveUrl(projectRelativeUrl, compileServerOrigin)
            const htmlCompiledUrl = resolveUrl(projectRelativeUrl, compileDirectoryRemoteUrl)
            const htmlResponse = await fetchModule(htmlServerUrl, `entryPointMap`)
            const htmlSource = await htmlResponse.text()
            const importmapHtmlNode = findFirstImportmapNode(htmlSource)
            if (importmapHtmlNode) {
              if (fetchImportmap === fetchImportmapFromParameter) {
                const srcAttribute = getHtmlNodeAttributeByName(importmapHtmlNode, "src")
                if (srcAttribute) {
                  logger.info(formatUseImportMap(importmapHtmlNode, htmlProjectUrl, htmlSource))
                  const importmapUrl = resolveUrl(srcAttribute.value, htmlCompiledUrl)
                  if (!urlIsInsideOf(importmapUrl, compileDirectoryRemoteUrl)) {
                    logger.warn(
                      formatImportmapOutsideCompileDirectory(
                        importmapHtmlNode,
                        htmlProjectUrl,
                        htmlSource,
                        compileDirectoryUrl,
                      ),
                    )
                  }
                  fetchImportmap = () => fetchAndNormalizeImportmap(importmapUrl)
                } else {
                  const textNode = getHtmlNodeTextNode(importmapHtmlNode)
                  if (textNode) {
                    logger.info(formatUseImportMap(importmapHtmlNode, htmlProjectUrl, htmlSource))
                    fetchImportmap = () => {
                      const importmapRaw = JSON.parse(textNode.value)
                      const importmap = normalizeImportMap(importmapRaw, htmlCompiledUrl)
                      return importmap
                    }
                  }
                }
              } else {
                logger.warn(formatIgnoreImportMap(importmapHtmlNode, htmlProjectUrl, htmlSource))
              }
            }

            entryPointsPrepared.push({
              type: "html",
              url: htmlServerUrl,
              chunkName,
              source: htmlSource,
            })
          } else {
            entryPointsPrepared.push({
              type: "js",
              relativeUrl: projectRelativeUrl,
              chunkName,
            })
          }
        }),
      )
      importMap = await fetchImportmap()

      // rollup will yell at us telling we did not provide an input option
      // if we provide only an html file without any script type module in it
      // but this can be desired to produce a bundle with only assets (html, css, images)
      // without any js
      // we emit an empty chunk, discards rollup warning about it and we manually remove
      // this chunk in generateBundle hook
      let atleastOneChunkEmitted = false
      compositeAssetHandler = createCompositeAssetHandler(
        {
          parse: async (target, notifiers) => {
            const contentType = target.content.type
            if (contentType === "text/html") {
              return parseHtmlAsset(target, notifiers, {
                minify,
                minifyHtmlOptions,
                htmlStringToHtmlAst: (htmlString) => {
                  const htmlAst = parseHtmlString(htmlString)
                  if (format !== "systemjs") {
                    return htmlAst
                  }

                  const htmlContainsModuleScript = htmlAstContains(htmlAst, htmlNodeIsScriptModule)
                  if (!htmlContainsModuleScript) {
                    return htmlAst
                  }

                  manipulateHtmlAst(htmlAst, {
                    scriptInjections: [
                      {
                        src: systemJsUrl,
                      },
                    ],
                  })
                  return htmlAst
                },
              })
            }

            if (contentType === "text/css") {
              return parseCssAsset(target, notifiers, { minify, minifyCssOptions })
            }

            if (contentType === "application/importmap+json") {
              return parseImportmapAsset(target, notifiers)
            }

            if (contentType === "text/javascript" || contentType === "application/javascript") {
              return parseJsAsset(target, notifiers, { minify, minifyJsOptions })
            }

            if (contentType === "image/svg+xml") {
              return parseSvgAsset(target, notifiers, { minify, minifyHtmlOptions })
            }

            return null
          },
          fetch: async (url, importer) => {
            const moduleResponse = await fetchModule(url, importer)
            return moduleResponse
          },
        },
        {
          logLevel: loggerToLogLevel(logger),
          projectDirectoryUrl: `${compileServerOrigin}`,
          bundleDirectoryRelativeUrl: urlToRelativeUrl(bundleDirectoryUrl, projectDirectoryUrl),
          urlToOriginalUrl: urlToOriginalServerUrl,
          urlToFileUrl: urlToProjectUrl,
          loadUrl: (url) => urlResponseBodyMap[url],
          resolveTargetUrl: ({ specifier, isJsModule }, target) => {
            if (target.isEntry && !target.isJsModule && isJsModule) {
              // html entry point
              // when html references a js we must wait for the compiled version of js
              const htmlCompiledUrl = urlToCompiledUrl(target.url)
              const jsAssetUrl = resolveUrl(specifier, htmlCompiledUrl)
              return jsAssetUrl
            }
            const url = resolveUrl(specifier, target.url)
            // ignore url outside project directory
            // a better version would console.warn about file url outside projectDirectoryUrl
            // and ignore them and console.info/debug about remote url (https, http, ...)
            const projectUrl = urlToProjectUrl(url)
            if (!projectUrl) {
              return { external: true, url }
            }
            return url
          },
          emitAsset: ({ source, name, fileName }) => {
            emitFile({
              type: "asset",
              source,
              name,
              fileName,
            })
          },
          connectTarget: (target) => {
            if (target.isExternal) {
              return null
            }

            if (target.isJsModule) {
              target.connect(async () => {
                const id = target.url
                if (typeof target.content !== "undefined") {
                  virtualModules[id] = String(target.content.value)
                }

                logger.debug(`emit chunk for ${shortenUrl(target.url)}`)
                atleastOneChunkEmitted = true
                const name = urlToRelativeUrl(
                  // get basename url
                  resolveUrl(urlToBasename(target.url), target.url),
                  // get importer url
                  urlToCompiledUrl(target.importers[0].url),
                )
                const rollupReferenceId = emitFile({
                  type: "chunk",
                  id,
                  name,
                  ...(target.previousJsReference
                    ? {
                        implicitlyLoadedAfterOneOf: [target.previousJsReference.url],
                      }
                    : {}),
                })

                return { rollupReferenceId }
              })
            } else {
              target.connect(async () => {
                await target.getReadyPromise()
                const { sourceAfterTransformation, fileNameForRollup } = target

                if (target.isInline) {
                  return {}
                }

                logger.debug(`emit asset for ${shortenUrl(target.url)}`)
                // const name = urlToRelativeUrl(
                //   urlToProjectUrl(target.url),
                //   urlToOriginalProjectUrl(target.importers[0].url),
                // )
                const rollupReferenceId = emitFile({
                  type: "asset",
                  source: sourceAfterTransformation,
                  // name: urlToFilename(target.url),
                  fileName: fileNameForRollup,
                })
                logger.debug(`${shortenUrl(target.url)} ready -> ${fileNameForRollup}`)
                return { rollupReferenceId }
              })
            }

            return null
          },
        },
      )

      await Promise.all(
        entryPointsPrepared.map(async ({ type, url, relativeUrl, chunkName, source }) => {
          if (type === "html") {
            await compositeAssetHandler.prepareHtmlEntry(url, {
              // don't hash the html entry point
              fileNamePattern: chunkName,
              source,
            })
          } else if (type === "js") {
            atleastOneChunkEmitted = true
            emitFile({
              type: "chunk",
              id: relativeUrl,
              name: chunkName,
              // don't hash js entry points
              fileName: chunkName,
            })
          }
        }),
      )
      if (!atleastOneChunkEmitted) {
        emitFile({
          type: "chunk",
          id: EMPTY_CHUNK_URL,
          fileName: "__empty__",
        })
      }
    },

    resolveId(specifier, importer) {
      if (importer === undefined) {
        if (specifier.endsWith(".html")) {
          importer = compileServerOrigin
        } else {
          importer = compileDirectoryRemoteUrl
        }
      } else {
        importer = urlToServerUrl(importer)
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
        urlImporterMap[importUrl] = importer
      }

      // keep external url intact
      const importProjectUrl = urlToProjectUrl(importUrl)
      if (!importProjectUrl) {
        return { id: specifier, external: true }
      }

      // const rollupId = urlToRollupId(importUrl, { projectDirectoryUrl, compileServerOrigin })
      logger.debug(`${specifier} imported by ${importer} resolved to ${importUrl}`)
      return urlToUrlForRollup(importUrl)
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {

    // },

    async load(id) {
      if (id === EMPTY_CHUNK_URL) {
        return ""
      }

      const moduleInfo = this.getModuleInfo(id)
      const url = urlToServerUrl(id)

      logger.debug(`loads ${url}`)
      const { responseUrl, contentRaw, content = "", map } = await loadModule(url, moduleInfo)

      saveUrlResponseBody(responseUrl, contentRaw)
      // handle redirection
      if (responseUrl !== url) {
        saveUrlResponseBody(url, contentRaw)
        urlRedirectionMap[url] = responseUrl
      }

      return { code: content, map }
    },

    // resolveImportMeta: () => {}

    // transform should not be required anymore as
    // we will receive
    // transform: async (moduleContent, rollupId) => {}

    outputOptions: (options) => {
      // rollup does not expects to have http dependency in the mix

      options.sourcemapPathTransform = (relativePath, sourcemapPath) => {
        const sourcemapUrl = fileSystemPathToUrl(sourcemapPath)
        const url = relativePathToUrl(relativePath, sourcemapUrl)
        const serverUrl = urlToServerUrl(url)
        const finalUrl = serverUrl in urlRedirectionMap ? urlRedirectionMap[serverUrl] : serverUrl
        const projectUrl = urlToProjectUrl(finalUrl)

        if (projectUrl) {
          relativePath = urlToRelativeUrl(projectUrl, sourcemapUrl)
          return relativePath
        }

        return finalUrl
      }

      const relativePathToUrl = (relativePath, sourcemapUrl) => {
        const rollupUrl = resolveUrl(relativePath, sourcemapUrl)
        // here relativePath contains a protocol
        // because rollup don't work with url but with filesystem paths
        // let fix it below
        const url = fixRollupUrl(rollupUrl)
        return url
      }

      return options
    },

    renderChunk: async (code, chunk) => {
      if (!minify) {
        return null
      }

      const result = await minifyJs(code, chunk.fileName, {
        sourceMap: {
          ...(chunk.map ? { content: JSON.stringify(chunk.map) } : {}),
          asObject: true,
        },
        ...(format === "global" ? { toplevel: false } : { toplevel: true }),
        ...minifyJsOptions,
      })
      return {
        code: result.code,
        map: result.map,
      }
    },

    async generateBundle(outputOptions, bundle) {
      const emptyChunkKey = Object.keys(bundle).find(
        (key) => bundle[key].facadeModuleId === EMPTY_CHUNK_URL,
      )
      if (emptyChunkKey) {
        delete bundle[emptyChunkKey]
      }

      // it's important to do this to emit late asset
      emitFile = (...args) => this.emitFile(...args)
      // malheureusement rollup ne permet pas de savoir lorsqu'un chunk
      // a fini d'etre résolu (parsing des imports statiques et dynamiques recursivement)
      // donc lorsque le build se termine on va indiquer
      // aux assets faisant référence a ces chunk js qu'ils sont terminés
      // et donc les assets peuvent connaitre le nom du chunk
      // et mettre a jour leur dépendance vers ce fichier js
      await compositeAssetHandler.resolveJsReferencesUsingRollupBundle(bundle, urlToServerUrl)
      compositeAssetHandler.cleanupRollupBundle(bundle)

      const result = rollupBundleToManifestAndMappings(bundle, {
        urlToOriginalProjectUrl,
        projectDirectoryUrl,
        bundleDirectoryUrl,
        compositeAssetHandler,
      })
      bundleMappings = result.bundleMappings
      bundleManifest = result.bundleManifest
      if (manifestFile) {
        const manifestFileUrl = resolveUrl("manifest.json", bundleDirectoryUrl)
        await writeFile(manifestFileUrl, JSON.stringify(bundleManifest, null, "  "))
      }

      rollupBundle = bundle

      logger.info(formatBundleGeneratedLog(bundle))
    },

    async writeBundle(options, bundle) {
      if (detectAndTransformIfNeededAsyncInsertedByRollup) {
        // ptet transformer ceci en renderChunk
        await transformAsyncInsertedByRollup({
          projectDirectoryUrl,
          bundleDirectoryUrl,
          babelPluginMap,
          bundle,
        })
      }
    },
  }

  const saveUrlResponseBody = (url, responseBody) => {
    urlResponseBodyMap[url] = responseBody
    const projectUrl = urlToProjectUrl(url)
    if (projectUrl && projectUrl !== url) {
      urlResponseBodyMap[projectUrl] = responseBody
    }
  }

  // take any url string and try to return a file url (an url inside projectDirectoryUrl)
  const urlToProjectUrl = (url) => {
    if (url.startsWith(projectDirectoryUrl)) {
      return url
    }

    const serverUrl = urlToServerUrl(url)
    if (serverUrl) {
      return `${projectDirectoryUrl}${serverUrl.slice(`${compileServerOrigin}/`.length)}`
    }

    return null
  }

  const urlToUrlForRollup = (url) => {
    if (url.startsWith(`${compileServerOrigin}/`)) {
      return `${compileServerOriginForRollup}/${url.slice(`${compileServerOrigin}/`.length)}`
    }
    return url
  }

  const urlToProjectRelativeUrl = (url) => {
    const projectUrl = urlToProjectUrl(url)
    if (!projectUrl) {
      return null
    }
    return urlToRelativeUrl(projectUrl, projectDirectoryUrl)
  }

  // take any url string and try to return the corresponding remote url (an url inside compileServerOrigin)
  const urlToServerUrl = (url) => {
    if (url.startsWith(`${compileServerOrigin}/`)) {
      return url
    }

    if (url.startsWith(`${compileServerOriginForRollup}/`)) {
      return `${compileServerOrigin}/${url.slice(`${compileServerOriginForRollup}/`.length)}`
    }

    if (url.startsWith(projectDirectoryUrl)) {
      return `${compileServerOrigin}/${url.slice(projectDirectoryUrl.length)}`
    }

    return null
  }

  const urlToOriginalServerUrl = (url) => {
    const serverUrl = urlToServerUrl(url)
    if (!serverUrl) {
      return null
    }

    if (!urlIsInsideOf(serverUrl, compileDirectoryRemoteUrl)) {
      return serverUrl
    }

    const relativeUrl = urlToRelativeUrl(serverUrl, compileDirectoryRemoteUrl)
    return resolveUrl(relativeUrl, compileServerOrigin)
  }

  // take any url string and try to return a file url inside project directory url
  // prefer the source url if the url is inside compile directory
  const urlToOriginalProjectUrl = (url) => {
    const projectUrl = urlToProjectUrl(url)
    if (!projectUrl) {
      return null
    }

    if (!urlIsInsideOf(projectUrl, compileDirectoryUrl)) {
      return projectUrl
    }

    const relativeUrl = urlToRelativeUrl(projectUrl, compileDirectoryUrl)
    return resolveUrl(relativeUrl, projectDirectoryUrl)
  }

  const urlToCompiledUrl = (url) => {
    const projectUrl = urlToProjectUrl(url)
    if (!projectUrl) {
      return null
    }

    if (urlIsInsideOf(projectUrl, compileDirectoryUrl)) {
      return projectUrl
    }

    const projectRelativeUrl = urlToProjectRelativeUrl(projectUrl)
    if (projectRelativeUrl) {
      return resolveUrl(projectRelativeUrl, compileDirectoryRemoteUrl)
    }

    return null
  }

  const loadModule = async (moduleUrl, moduleInfo) => {
    if (moduleUrl in virtualModules) {
      const codeInput = virtualModules[moduleUrl]

      const { code, map } = await transformJs({
        projectDirectoryUrl,
        code: codeInput,
        url: urlToProjectUrl(moduleUrl), // transformJs expect a file:// url
        babelPluginMap,
        transformModuleIntoSystemFormat: false,
      })

      return {
        responseUrl: moduleUrl,
        contentRaw: code,
        content: code,
        map,
      }
    }

    const importerUrl = urlImporterMap[moduleUrl]
    const moduleResponse = await fetchModule(
      moduleUrl,
      urlToFileSystemPath(urlToProjectUrl(importerUrl) || importerUrl),
    )
    const contentType = moduleResponse.headers["content-type"] || ""
    const commonData = {
      responseUrl: moduleResponse.url,
    }

    // keep this in sync with module-registration.js
    if (contentType === "application/javascript" || contentType === "text/javascript") {
      const responseBodyAsString = await moduleResponse.text()
      const js = responseBodyAsString
      return {
        ...commonData,
        contentRaw: js,
        content: js,
        map: await fetchSourcemap(moduleUrl, js, {
          cancellationToken,
          logger,
        }),
      }
    }

    if (contentType === "application/json" || contentType === "application/importmap+json") {
      const responseBodyAsString = await moduleResponse.text()
      // there is no need to minify the json string
      // because it becomes valid javascript
      // that will be minified by minifyJs inside renderChunk
      const json = responseBodyAsString
      return {
        ...commonData,
        contentRaw: json,
        content: `export default ${json}`,
      }
    }

    const importReference = await compositeAssetHandler.createJsModuleImportReference(
      moduleResponse,
      {
        moduleInfo,
        importerUrl,
      },
    )
    const importTarget = importReference.target
    const content = importTarget.isInline
      ? `export default ${getTargetAsBase64Url(importTarget)}`
      : `export default import.meta.ROLLUP_FILE_URL_${importTarget.rollupReferenceId}`
    return {
      ...commonData,
      contentRaw: String(importTarget.content.value),
      content,
    }
  }

  const fetchModule = async (moduleUrl, importer) => {
    const response = await fetchUrl(moduleUrl, {
      cancellationToken,
      ignoreHttpsError: true,
    })
    if (response.status === 404) {
      throw new Error(formatFileNotFound(urlToProjectUrl(response.url), importer))
    }

    const okValidation = validateResponseStatusIsOk(response, importer)

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
    getResult: () => {
      return {
        rollupBundle,
        urlResponseBodyMap,
        bundleMappings,
        bundleManifest,
      }
    },
  }
}

const fixRollupUrl = (rollupUrl) => {
  // fix rollup not supporting source being http
  const httpIndex = rollupUrl.indexOf(`http:/`, 1)
  if (httpIndex > -1) {
    return `http://${rollupUrl.slice(httpIndex + `http:/`.length)}`
  }

  const httpsIndex = rollupUrl.indexOf("https:/", 1)
  if (httpsIndex > -1) {
    return `https://${rollupUrl.slice(httpsIndex + `https:/`.length)}`
  }

  const fileIndex = rollupUrl.indexOf("file:", 1)
  if (fileIndex > -1) {
    return `file://${rollupUrl.slice(fileIndex + `file:`.length)}`
  }

  return rollupUrl
}

const formatFileNotFound = (url, importer) => {
  return `A file cannot be found.
--- file ---
${urlToFileSystemPath(url)}
--- imported by ---
${importer}`
}

const showImportmapSourceLocation = (importmapHtmlNode, htmlUrl, htmlSource) => {
  const { line, column } = getHtmlNodeLocation(importmapHtmlNode)

  return `${htmlUrl}:${line}:${column}

${showSourceLocation(htmlSource, {
  line,
  column,
})}
`
}

const formatIgnoreImportMap = (importmapHtmlNode, htmlUrl, htmlSource) => {
  return `ignore importmap found in html file.
${showImportmapSourceLocation(importmapHtmlNode, htmlUrl, htmlSource)}`
}

const formatUseImportMap = (importmapHtmlNode, htmlUrl, htmlSource) => {
  return `use importmap found in html file.
${showImportmapSourceLocation(importmapHtmlNode, htmlUrl, htmlSource)}`
}

const formatImportmapOutsideCompileDirectory = (
  importmapHtmlNode,
  htmlUrl,
  htmlSource,
  compileDirectoryUrl,
) => {
  return `WARNING: found importmap outside compile directory.
Remapped import will not be compiled.
You should make importmap source relative.
${showImportmapSourceLocation(importmapHtmlNode, htmlUrl, htmlSource)}
--- compile directory url ---
${compileDirectoryUrl}`
}

const fetchAndNormalizeImportmap = async (importmapUrl, { allow404 = false } = {}) => {
  const importmapResponse = await fetchUrl(importmapUrl)
  if (allow404 && importmapResponse.status === 404) {
    return null
  }
  const importmap = await importmapResponse.json()
  const importmapNormalized = normalizeImportMap(importmap, importmapUrl)
  return importmapNormalized
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

const rollupBundleToManifestAndMappings = (
  rollupBundle,
  { urlToOriginalProjectUrl, projectDirectoryUrl, bundleDirectoryUrl, compositeAssetHandler },
) => {
  const chunkManifest = {}
  const assetManifest = {}
  const chunkMappings = {}
  Object.keys(rollupBundle).forEach((key) => {
    const file = rollupBundle[key]
    if (file.type === "chunk") {
      const id = file.facadeModuleId
      if (id) {
        const originalProjectUrl = urlToOriginalProjectUrl(id)
        const projectRelativeUrl = urlToRelativeUrl(originalProjectUrl, projectDirectoryUrl)
        chunkMappings[projectRelativeUrl] = file.fileName
      } else {
        const sourcePath = file.map.sources[file.map.sources.length - 1]
        const fileBundleUrl = resolveUrl(file.fileName, bundleDirectoryUrl)
        const originalProjectUrl = resolveUrl(sourcePath, fileBundleUrl)
        const projectRelativeUrl = urlToRelativeUrl(originalProjectUrl, projectDirectoryUrl)
        chunkMappings[projectRelativeUrl] = file.fileName
      }
      chunkManifest[rollupFileNameWithoutHash(file.fileName)] = file.fileName
    } else {
      assetManifest[rollupFileNameWithoutHash(file.fileName)] = file.fileName
    }
  })

  const assetMappings = compositeAssetHandler.rollupBundleToAssetMappings(rollupBundle)
  const mappings = {
    ...chunkMappings,
    ...assetMappings,
  }

  const manifest = {
    ...chunkManifest,
    ...assetManifest,
  }
  const manifestKeysSorted = Object.keys(manifest).sort(comparePathnames)
  const bundleManifest = {}
  manifestKeysSorted.forEach((key) => {
    bundleManifest[key] = manifest[key]
  })

  const mappingKeysSorted = Object.keys(mappings).sort(comparePathnames)
  const bundleMappings = {}
  mappingKeysSorted.forEach((key) => {
    bundleMappings[key] = mappings[key]
  })
  return {
    bundleMappings,
    bundleManifest,
  }
}

const rollupFileNameWithoutHash = (fileName) => {
  return fileName.replace(/-[a-z0-9]{8,}(\..*?)?$/, (_, afterHash = "") => {
    return afterHash
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
