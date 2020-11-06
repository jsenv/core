/* eslint-disable import/max-dependencies */
import { extname } from "path"
import { composeTwoImportMaps, normalizeImportMap, resolveImport } from "@jsenv/import-map"
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
  metaMapToSpecifierMetaMap,
  normalizeSpecifierMetaMap,
  urlToMeta,
} from "@jsenv/util"

import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import { validateResponseStatusIsOk } from "@jsenv/core/src/internal/validateResponseStatusIsOk.js"
import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
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
import { setJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"

import { showSourceLocation } from "./showSourceLocation.js"
import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { createCompositeAssetHandler } from "./compositeAsset.js"
import { computeBundleRelativeUrl } from "./computeBundleRelativeUrl.js"
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
  importMetaEnvFileRelativeUrl,
  compileDirectoryRelativeUrl,
  compileServerOrigin,
  importDefaultExtension,
  externalImportSpecifiers,
  externalImportUrlPatterns,
  babelPluginMap,
  node,
  browser,

  format,
  useImportMapForJsBundleUrls = format === "systemjs",
  systemJsUrl,
  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
  manifestFile,
  writeOnFileSystem,

  bundleDirectoryUrl,
}) => {
  const urlImporterMap = {}
  const urlResponseBodyMap = {}
  const virtualModules = {}
  const urlRedirectionMap = {}
  const jsModulesInHtml = {}

  const externalUrlPredicate = externalImportUrlPatternsToExternalUrlPredicate(
    externalImportUrlPatterns,
    projectDirectoryUrl,
  )

  // map fileName (bundle relative urls without hash) to bundle relative url
  let bundleManifest = {}
  const fileNameToBundleRelativeUrl = (fileName) => {
    if (fileName in bundleManifest) {
      return bundleManifest[fileName]
    }
    return null
  }
  const bundleRelativeUrlToFileName = (bundleRelativeUrl) => {
    const fileName = Object.keys(bundleManifest).find(
      (key) => bundleManifest[key] === bundleRelativeUrl,
    )
    return fileName
  }
  const addFileNameMapping = (fileName, bundleRelativeUrl) => {
    bundleManifest[fileName] = bundleRelativeUrl
  }
  const bundleRelativeUrlsUsedInJs = []
  const markBundleRelativeUrlAsUsedByJs = (bundleRelativeUrl) => {
    bundleRelativeUrlsUsedInJs.push(bundleRelativeUrl)
  }
  const createImportMapForFilesUsedInJs = () => {
    const topLevelMappings = {}
    bundleRelativeUrlsUsedInJs.sort(comparePathnames).forEach((bundleRelativeUrl) => {
      const fileName = bundleRelativeUrlToFileName(bundleRelativeUrl)
      if (fileName !== bundleRelativeUrl) {
        topLevelMappings[`./${fileName}`] = `./${bundleRelativeUrl}`
      }
    })
    return {
      imports: topLevelMappings,
    }
  }

  let bundleMappings = {}
  // a clean rollup bundle where keys are bundle relative urls
  // and values rollup chunk or asset
  // we need this because we sometimes tell rollup
  // that a file.fileName is something while it's not really this
  // because of remapping
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

  const emitAsset = ({ source, fileName }) => {
    const bundleRelativeUrl = fileName
    if (useImportMapForJsBundleUrls) {
      fileName = rollupFileNameWithoutHash(bundleRelativeUrl)
    } else {
      fileName = bundleRelativeUrl
    }
    addFileNameMapping(fileName, bundleRelativeUrl)

    return emitFile({
      type: "asset",
      source,
      fileName,
    })
  }
  const emitChunk = (chunk) =>
    emitFile({
      type: "chunk",
      ...chunk,
    })

  const jsenvRollupPlugin = {
    name: "jsenv",

    async buildStart() {
      emitFile = (...args) => this.emitFile(...args)

      // https://github.com/easesu/rollup-plugin-html-input/blob/master/index.js
      // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string

      const entryPointsPrepared = []
      await Promise.all(
        Object.keys(entryPointMap).map(async (key) => {
          const entryProjectUrl = resolveUrl(key, projectDirectoryUrl)
          const entryBundleUrl = resolveUrl(entryPointMap[key], bundleDirectoryUrl)

          const entryProjectRelativeUrl = urlToRelativeUrl(entryProjectUrl, projectDirectoryUrl)
          const entryBundleRelativeUrl = urlToRelativeUrl(entryBundleUrl, bundleDirectoryUrl)

          const entryServerUrl = resolveUrl(entryProjectRelativeUrl, compileServerOrigin)
          const entryCompiledUrl = resolveUrl(entryProjectRelativeUrl, compileDirectoryRemoteUrl)

          const entryResponse = await fetchModule(entryServerUrl, `entryPointMap`)
          const entryContentType = entryResponse.headers["content-type"]

          if (entryContentType === "text/html") {
            const htmlSource = await entryResponse.text()
            const importmapHtmlNode = findFirstImportmapNode(htmlSource)
            if (importmapHtmlNode) {
              if (fetchImportmap === fetchImportmapFromParameter) {
                const srcAttribute = getHtmlNodeAttributeByName(importmapHtmlNode, "src")
                if (srcAttribute) {
                  logger.info(formatUseImportMap(importmapHtmlNode, entryProjectUrl, htmlSource))
                  const importmapUrl = resolveUrl(srcAttribute.value, entryCompiledUrl)
                  if (!urlIsInsideOf(importmapUrl, compileDirectoryRemoteUrl)) {
                    logger.warn(
                      formatImportmapOutsideCompileDirectory(
                        importmapHtmlNode,
                        entryProjectUrl,
                        htmlSource,
                        compileDirectoryUrl,
                      ),
                    )
                  }
                  fetchImportmap = () => fetchAndNormalizeImportmap(importmapUrl)
                } else {
                  const textNode = getHtmlNodeTextNode(importmapHtmlNode)
                  if (textNode) {
                    logger.info(formatUseImportMap(importmapHtmlNode, entryProjectUrl, htmlSource))
                    fetchImportmap = () => {
                      const importmapRaw = JSON.parse(textNode.value)
                      const importmap = normalizeImportMap(importmapRaw, entryCompiledUrl)
                      return importmap
                    }
                  }
                }
              } else {
                logger.warn(formatIgnoreImportMap(importmapHtmlNode, entryProjectUrl, htmlSource))
              }
            }

            entryPointsPrepared.push({
              entryContentType,
              entryProjectRelativeUrl,
              entryBundleRelativeUrl,
              entrySource: htmlSource,
            })
          } else if (
            entryContentType === "application/javascript" ||
            entryContentType === "text/javascript"
          ) {
            entryPointsPrepared.push({
              entryContentType: "application/javascript",
              entryProjectRelativeUrl,
              entryBundleRelativeUrl,
            })
          } else {
            entryPointsPrepared.push({
              entryContentType,
              entryProjectRelativeUrl,
              entryBundleRelativeUrl,
              entrySource: Buffer.from(await entryResponse.arrayBuffer()),
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

                  // force presence of systemjs script if html contains a module script
                  const injectSystemJsScriptIfNeeded = (htmlAst) => {
                    if (format !== "systemjs") {
                      return
                    }

                    const htmlContainsModuleScript = htmlAstContains(
                      htmlAst,
                      htmlNodeIsScriptModule,
                    )
                    if (!htmlContainsModuleScript) {
                      return
                    }

                    manipulateHtmlAst(htmlAst, {
                      scriptInjections: [
                        {
                          src: systemJsUrl,
                        },
                      ],
                    })
                  }

                  // force the presence of a fake+inline+empty importmap script
                  // if html contains no importmap and we useImportMapForJsBundleUrls
                  // this inline importmap will be transformed later to have top level remapping
                  // required to target hashed js urls
                  const injectImportMapScriptIfNeeded = (htmlAst) => {
                    if (!useImportMapForJsBundleUrls) {
                      return
                    }
                    if (findFirstImportmapNode(htmlAst)) {
                      return
                    }

                    manipulateHtmlAst(htmlAst, {
                      scriptInjections: [
                        {
                          type: "importmap",
                          id: "jsenv-bundle-importmap",
                          text: "{}",
                        },
                      ],
                    })
                  }

                  injectSystemJsScriptIfNeeded(htmlAst)
                  injectImportMapScriptIfNeeded(htmlAst)

                  return htmlAst
                },
                transformImportmapTarget: (importmapTarget) => {
                  if (!useImportMapForJsBundleUrls) {
                    return
                  }
                  injectImportedFilesIntoImportMapTarget(
                    importmapTarget,
                    createImportMapForFilesUsedInJs(),
                  )
                },
              })
            }

            if (contentType === "text/css") {
              return parseCssAsset(target, notifiers, { minify, minifyCssOptions })
            }

            if (contentType === "application/importmap+json") {
              return parseImportmapAsset(target, notifiers, { minify })
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
          format,
          projectDirectoryUrl: `${compileServerOrigin}`,
          bundleDirectoryRelativeUrl: urlToRelativeUrl(bundleDirectoryUrl, projectDirectoryUrl),
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
          emitAsset,
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
                jsModulesInHtml[urlToUrlForRollup(id)] = true
                const rollupReferenceId = emitChunk({
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
                const { sourceAfterTransformation, bundleRelativeUrl } = target

                if (target.isInline) {
                  return {}
                }

                logger.debug(`emit asset for ${shortenUrl(target.url)}`)

                const fileName = bundleRelativeUrl
                const rollupReferenceId = emitAsset({
                  source: sourceAfterTransformation,
                  fileName,
                })

                logger.debug(`${shortenUrl(target.url)} ready -> ${bundleRelativeUrl}`)
                return { rollupReferenceId }
              })
            }

            return null
          },
        },
      )

      await Promise.all(
        entryPointsPrepared.map(
          async ({
            entryContentType,
            entryProjectRelativeUrl,
            entryBundleRelativeUrl,
            entrySource,
          }) => {
            if (entryContentType === "text/html") {
              const entryUrl = resolveUrl(entryProjectRelativeUrl, compileServerOrigin)
              await compositeAssetHandler.createReferenceForAssetEntry(entryUrl, {
                entryContentType,
                entryProjectRelativeUrl,
                entryBundleRelativeUrl,
                entrySource,
              })
            } else if (entryContentType === "application/javascript") {
              atleastOneChunkEmitted = true
              emitChunk({
                id: ensureRelativeUrlNotation(entryProjectRelativeUrl),
                name: entryBundleRelativeUrl,
                // don't hash js entry points
                fileName: entryBundleRelativeUrl,
              })
            } else {
              const entryUrl = resolveUrl(entryProjectRelativeUrl, compileServerOrigin)
              await compositeAssetHandler.createReferenceForAssetEntry(entryUrl, {
                entryContentType,
                entryProjectRelativeUrl,
                entryBundleRelativeUrl,
                entrySource,
              })
            }
          },
        ),
      )
      if (!atleastOneChunkEmitted) {
        emitChunk({
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

      if (externalUrlPredicate(urlToOriginalProjectUrl(importProjectUrl))) {
        return { id: specifier, external: true }
      }

      // const rollupId = urlToRollupId(importUrl, { projectDirectoryUrl, compileServerOrigin })
      logger.debug(`${specifier} imported by ${importer} resolved to ${importUrl}`)
      return urlToUrlForRollup(importUrl)
    },

    ...(useImportMapForJsBundleUrls
      ? {
          resolveFileUrl: ({ fileName }) => {
            return `System.resolve("./${fileName}", module.meta.url)`
          },
        }
      : {}),

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

    outputOptions: (outputOptions) => {
      const extension = extname(entryPointMap[Object.keys(entryPointMap)[0]])
      const outputExtension = extension === ".html" ? ".js" : extension

      outputOptions.entryFileNames = `[name]${outputExtension}`
      outputOptions.chunkFileNames = useImportMapForJsBundleUrls
        ? `[name]${outputExtension}`
        : `[name]-[hash]${outputExtension}`

      // rollup does not expects to have http dependency in the mix: fix them
      outputOptions.sourcemapPathTransform = (relativePath, sourcemapPath) => {
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

      return outputOptions
    },

    renderChunk: async (code, chunk) => {
      let map = chunk.map

      if (!minify) {
        return null
      }

      const result = await minifyJs(code, chunk.fileName, {
        sourceMap: {
          ...(map ? { content: JSON.stringify(map) } : {}),
          asObject: true,
        },
        ...(format === "global" ? { toplevel: false } : { toplevel: true }),
        ...minifyJsOptions,
      })
      code = result.code
      map = result.map
      return {
        code,
        map,
      }
    },

    async generateBundle(outputOptions, bundleForRollup) {
      const jsBundle = {}
      Object.keys(bundleForRollup).forEach((fileName) => {
        const file = bundleForRollup[fileName]
        if (file.type === "chunk" && file.facadeModuleId === EMPTY_CHUNK_URL) {
          return
        }

        if (file.type === "chunk") {
          let bundleRelativeUrl
          const canBeHashed = file.facadeModuleId in jsModulesInHtml || !file.isEntry
          if (useImportMapForJsBundleUrls) {
            if (canBeHashed) {
              bundleRelativeUrl = computeBundleRelativeUrl(
                resolveUrl(fileName, bundleDirectoryUrl),
                file.code,
                `[name]-[hash][extname]`,
              )
            } else {
              bundleRelativeUrl = fileName
            }
          } else {
            bundleRelativeUrl = fileName
            fileName = rollupFileNameWithoutHash(fileName)
          }

          if (canBeHashed) {
            markBundleRelativeUrlAsUsedByJs(bundleRelativeUrl)
          }
          addFileNameMapping(fileName, bundleRelativeUrl)
          jsBundle[bundleRelativeUrl] = file
        }
      })

      // it's important to do this to emit late asset
      emitFile = (...args) => this.emitFile(...args)

      // malheureusement rollup ne permet pas de savoir lorsqu'un chunk
      // a fini d'etre résolu (parsing des imports statiques et dynamiques recursivement)
      // donc lorsque le build se termine on va indiquer
      // aux assets faisant référence a ces chunk js qu'ils sont terminés
      // et donc les assets peuvent connaitre le nom du chunk
      // et mettre a jour leur dépendance vers ce fichier js
      const rollupChunkReadyCallbackMap = compositeAssetHandler.getRollupChunkReadyCallbackMap()
      Object.keys(rollupChunkReadyCallbackMap).forEach((key) => {
        const bundleRelativeUrl = Object.keys(jsBundle).find((bundleRelativeUrlCandidate) => {
          const file = jsBundle[bundleRelativeUrlCandidate]
          const { facadeModuleId } = file
          return facadeModuleId && urlToServerUrl(facadeModuleId) === key
        })
        const file = jsBundle[bundleRelativeUrl]
        const sourceAfterTransformation = file.code
        const fileName =useImportMapForJsBundleUrls
            ? bundleRelativeUrlToFileName(bundleRelativeUrl)
            : bundleRelativeUrl

        logger.debug(`resolve rollup chunk ${shortenUrl(key)}`)
        rollupChunkReadyCallbackMap[key]({
          sourceAfterTransformation,
          bundleRelativeUrl,
          fileName,
        })
      })
      // wait html files to be emitted
      await compositeAssetHandler.getAllAssetEntryEmittedPromise()

      const assetBundle = {}
      const bundleRelativeUrlsToClean = compositeAssetHandler.getBundleRelativeUrlsToClean()
      Object.keys(bundleForRollup).forEach((fileName) => {
        const file = bundleForRollup[fileName]
        if (file.type !== "asset") {
          return
        }

        const bundleRelativeUrl = fileNameToBundleRelativeUrl(fileName)
        // ignore potential useless assets which happens when:
        // - sourcemap re-emitted
        // - importmap re-emitted to have bundleRelativeUrlMap
        if (bundleRelativeUrlsToClean.includes(bundleRelativeUrl)) {
          return
        }

        assetBundle[bundleRelativeUrl] = file
      })

      rollupBundle = {
        ...jsBundle,
        ...assetBundle,
      }

      Object.keys(rollupBundle).forEach((bundleRelativeUrl) => {
        const file = rollupBundle[bundleRelativeUrl]

        if (file.type === "chunk") {
          const id = file.facadeModuleId
          if (id) {
            const originalProjectUrl = urlToOriginalProjectUrl(id)
            const originalProjectRelativeUrl = urlToRelativeUrl(
              originalProjectUrl,
              projectDirectoryUrl,
            )
            bundleMappings[originalProjectRelativeUrl] = bundleRelativeUrl
          } else {
            const sourcePath = file.map.sources[file.map.sources.length - 1]
            const fileBundleUrl = resolveUrl(file.fileName, bundleDirectoryUrl)
            const originalProjectUrl = resolveUrl(sourcePath, fileBundleUrl)
            const originalProjectRelativeUrl = urlToRelativeUrl(
              originalProjectUrl,
              projectDirectoryUrl,
            )
            bundleMappings[originalProjectRelativeUrl] = bundleRelativeUrl
          }
        } else {
          const assetUrl = compositeAssetHandler.findAssetUrlByBundleRelativeUrl(bundleRelativeUrl)
          if (assetUrl) {
            const originalProjectUrl = urlToOriginalProjectUrl(assetUrl)
            const originalProjectRelativeUrl = urlToRelativeUrl(
              originalProjectUrl,
              projectDirectoryUrl,
            )
            bundleMappings[originalProjectRelativeUrl] = bundleRelativeUrl
          } else {
            // the asset does not exists in the project it was generated during bundling
            // ici il est possible de trouver un asset ayant été redirigé ailleurs (sourcemap)
          }
        }
      })

      rollupBundle = sortObjectByPathnames(rollupBundle)
      bundleManifest = sortObjectByPathnames(bundleManifest)
      bundleMappings = sortObjectByPathnames(bundleMappings)

      if (manifestFile) {
        const manifestFileUrl = resolveUrl("manifest.json", bundleDirectoryUrl)
        await writeFile(manifestFileUrl, JSON.stringify(bundleManifest, null, "  "))
      }

      logger.info(formatBundleGeneratedLog(rollupBundle))

      if (writeOnFileSystem) {
        await Promise.all(
          Object.keys(rollupBundle).map(async (bundleRelativeUrl) => {
            const file = rollupBundle[bundleRelativeUrl]
            const fileBundleUrl = resolveUrl(bundleRelativeUrl, bundleDirectoryUrl)

            if (file.type === "chunk") {
              let fileCode = file.code
              if (file.map) {
                const sourcemapBundleRelativeUrl = `${bundleRelativeUrl}.map`
                if (sourcemapBundleRelativeUrl in rollupBundle === false) {
                  const sourcemapBundleUrl = resolveUrl(
                    sourcemapBundleRelativeUrl,
                    bundleDirectoryUrl,
                  )
                  const fileSourcemapString = JSON.stringify(file.map, null, "  ")
                  await writeFile(sourcemapBundleUrl, fileSourcemapString)

                  const sourcemapBundleUrlRelativeToFileBundleUrl = urlToRelativeUrl(
                    sourcemapBundleUrl,
                    fileBundleUrl,
                  )
                  fileCode = setJavaScriptSourceMappingUrl(
                    fileCode,
                    sourcemapBundleUrlRelativeToFileBundleUrl,
                  )
                }
              }
              await writeFile(fileBundleUrl, fileCode)
            } else {
              await writeFile(fileBundleUrl, file.source)
            }
          }),
        )
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

  // const urlToOriginalServerUrl = (url) => {
  //   const serverUrl = urlToServerUrl(url)
  //   if (!serverUrl) {
  //     return null
  //   }

  //   if (!urlIsInsideOf(serverUrl, compileDirectoryRemoteUrl)) {
  //     return serverUrl
  //   }

  //   const relativeUrl = urlToRelativeUrl(serverUrl, compileDirectoryRemoteUrl)
  //   return resolveUrl(relativeUrl, compileServerOrigin)
  // }

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
        importMetaEnvFileRelativeUrl,
        code: codeInput,
        url: urlToProjectUrl(moduleUrl), // transformJs expect a file:// url
        babelPluginMap,
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

    const importReference = await compositeAssetHandler.createReferenceForJsModuleImport(
      moduleResponse,
      {
        moduleInfo,
        importerUrl,
      },
    )
    const importTarget = importReference.target
    markBundleRelativeUrlAsUsedByJs(importTarget.bundleRelativeUrl)
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
        bundleImportMap: createImportMapForFilesUsedInJs(),
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

const sortObjectByPathnames = (object) => {
  const objectSorted = {}
  const keysSorted = Object.keys(object).sort(comparePathnames)
  keysSorted.forEach((key) => {
    objectSorted[key] = object[key]
  })
  return objectSorted
}

const rollupFileNameWithoutHash = (fileName) => {
  return fileName.replace(/-[a-z0-9]{8,}(\..*?)?$/, (_, afterHash = "") => {
    return afterHash
  })
}

const injectImportedFilesIntoImportMapTarget = (importmapTarget, importMapToInject) => {
  const { sourceAfterTransformation } = importmapTarget
  const importMapOriginal = JSON.parse(sourceAfterTransformation)

  const importMap = composeTwoImportMaps(importMapOriginal, importMapToInject)
  importmapTarget.updateOnceReady({
    sourceAfterTransformation: JSON.stringify(importMap),
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

// otherwise importmap handle it as a bare import
const ensureRelativeUrlNotation = (relativeUrl) => {
  if (relativeUrl.startsWith("../")) {
    return relativeUrl
  }
  return `./${relativeUrl}`
}

const externalImportUrlPatternsToExternalUrlPredicate = (
  externalImportUrlPatterns,
  projectDirectoryUrl,
) => {
  const externalImportUrlMetaMap = metaMapToSpecifierMetaMap({
    external: {
      ...externalImportUrlPatterns,
      "node_modules/@jsenv/core/src/internal/import-meta/": false,
      "node_modules/@jsenv/core/helpers/": false,
    },
  })
  const externalImportUrlMetaMapNormalized = normalizeSpecifierMetaMap(
    externalImportUrlMetaMap,
    projectDirectoryUrl,
  )
  return (url) => {
    const meta = urlToMeta({ url, specifierMetaMap: externalImportUrlMetaMapNormalized })
    return Boolean(meta.external)
  }
}
