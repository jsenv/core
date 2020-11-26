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
import { computeBuildRelativeUrl } from "./computeBuildRelativeUrl.js"
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
  longTermCaching,
  useImportMapToImproveLongTermCaching,
  systemJsUrl,
  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
  manifestFile,
  writeOnFileSystem,

  buildDirectoryUrl,
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

  // map fileName (build relative urls without hash) to build relative url
  let buildManifest = {}
  const fileNameToBuildRelativeUrl = (fileName) => {
    if (fileName in buildManifest) {
      return buildManifest[fileName]
    }
    return null
  }
  const buildRelativeUrlToFileName = (buildRelativeUrl) => {
    const fileName = Object.keys(buildManifest).find(
      (key) => buildManifest[key] === buildRelativeUrl,
    )
    return fileName
  }
  const addFileNameMapping = (fileName, buildRelativeUrl) => {
    buildManifest[fileName] = buildRelativeUrl
  }
  const buildRelativeUrlsUsedInJs = []
  const markBuildRelativeUrlAsUsedByJs = (buildRelativeUrl) => {
    buildRelativeUrlsUsedInJs.push(buildRelativeUrl)
  }
  const createImportMapForFilesUsedInJs = () => {
    const topLevelMappings = {}
    buildRelativeUrlsUsedInJs.sort(comparePathnames).forEach((buildRelativeUrl) => {
      const fileName = buildRelativeUrlToFileName(buildRelativeUrl)
      if (fileName !== buildRelativeUrl) {
        topLevelMappings[`./${fileName}`] = `./${buildRelativeUrl}`
      }
    })
    return {
      imports: topLevelMappings,
    }
  }

  let buildMappings = {}
  // an object where keys are build relative urls
  // and values rollup chunk or asset
  // we need this because we sometimes tell rollup
  // that a file.fileName is something while it's not really this
  // because of remapping
  let rollupBuild

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
    const buildRelativeUrl = fileName
    if (useImportMapToImproveLongTermCaching || !longTermCaching) {
      fileName = rollupFileNameWithoutHash(buildRelativeUrl)
    } else {
      fileName = buildRelativeUrl
    }
    addFileNameMapping(fileName, buildRelativeUrl)

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
      logger.info(`
start building project
--- project directory path ---
${urlToFileSystemPath(projectDirectoryUrl)}
--- build directory path ---
${urlToFileSystemPath(buildDirectoryUrl)}
--- entry point map ---
${JSON.stringify(entryPointMap, null, "  ")}`)

      emitFile = (...args) => this.emitFile(...args)

      // https://github.com/easesu/rollup-plugin-html-input/blob/master/index.js
      // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string

      const entryPointsPrepared = []
      await Promise.all(
        Object.keys(entryPointMap).map(async (key) => {
          const entryProjectUrl = resolveUrl(key, projectDirectoryUrl)
          const entryBuildUrl = resolveUrl(entryPointMap[key], buildDirectoryUrl)

          const entryProjectRelativeUrl = urlToRelativeUrl(entryProjectUrl, projectDirectoryUrl)
          const entryBuildRelativeUrl = urlToRelativeUrl(entryBuildUrl, buildDirectoryUrl)

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
              entryBuildRelativeUrl,
              entrySource: htmlSource,
            })
          } else if (
            entryContentType === "application/javascript" ||
            entryContentType === "text/javascript"
          ) {
            entryPointsPrepared.push({
              entryContentType: "application/javascript",
              entryProjectRelativeUrl,
              entryBuildRelativeUrl,
            })
          } else {
            entryPointsPrepared.push({
              entryContentType,
              entryProjectRelativeUrl,
              entryBuildRelativeUrl,
              entrySource: Buffer.from(await entryResponse.arrayBuffer()),
            })
          }
        }),
      )
      importMap = await fetchImportmap()

      // rollup will yell at us telling we did not provide an input option
      // if we provide only an html file without any script type module in it
      // but this can be desired to produce a build with only assets (html, css, images)
      // without any js
      // we emit an empty chunk, discards rollup warning about it and we manually remove
      // this chunk in buildProject hook
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
                  // if html contains no importmap and we useImportMapToImproveLongTermCaching
                  // this inline importmap will be transformed later to have top level remapping
                  // required to target hashed js urls
                  const injectImportMapScriptIfNeeded = (htmlAst) => {
                    if (!useImportMapToImproveLongTermCaching) {
                      return
                    }
                    if (findFirstImportmapNode(htmlAst)) {
                      return
                    }

                    manipulateHtmlAst(htmlAst, {
                      scriptInjections: [
                        {
                          type: "importmap",
                          id: "jsenv-build-importmap",
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
                  if (!useImportMapToImproveLongTermCaching) {
                    return
                  }
                  injectImportedFilesIntoImportMapTarget(
                    importmapTarget,
                    createImportMapForFilesUsedInJs(),
                    minify,
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
          buildDirectoryRelativeUrl: urlToRelativeUrl(buildDirectoryUrl, projectDirectoryUrl),
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
                const { sourceAfterTransformation, buildRelativeUrl } = target

                if (target.isInline) {
                  return {}
                }

                logger.debug(`emit asset for ${shortenUrl(target.url)}`)

                const fileName = buildRelativeUrl
                const rollupReferenceId = emitAsset({
                  source: sourceAfterTransformation,
                  fileName,
                })

                logger.debug(`${shortenUrl(target.url)} ready -> ${buildRelativeUrl}`)
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
            entryBuildRelativeUrl,
            entrySource,
          }) => {
            if (entryContentType === "text/html") {
              const entryUrl = resolveUrl(entryProjectRelativeUrl, compileServerOrigin)
              await compositeAssetHandler.createReferenceForAssetEntry(entryUrl, {
                entryContentType,
                entryProjectRelativeUrl,
                entryBuildRelativeUrl,
                entrySource,
              })
            } else if (entryContentType === "application/javascript") {
              atleastOneChunkEmitted = true
              emitChunk({
                id: ensureRelativeUrlNotation(entryProjectRelativeUrl),
                name: entryBuildRelativeUrl,
                // don't hash js entry points
                fileName: entryBuildRelativeUrl,
              })
            } else {
              const entryUrl = resolveUrl(entryProjectRelativeUrl, compileServerOrigin)
              await compositeAssetHandler.createReferenceForAssetEntry(entryUrl, {
                entryContentType,
                entryProjectRelativeUrl,
                entryBuildRelativeUrl,
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

    ...(format === "systemjs"
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
      outputOptions.chunkFileNames =
        useImportMapToImproveLongTermCaching || !longTermCaching
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

    async generateBundle(outputOptions, rollupResult) {
      const jsBuild = {}
      Object.keys(rollupResult).forEach((fileName) => {
        const file = rollupResult[fileName]
        if (file.type === "chunk" && file.facadeModuleId === EMPTY_CHUNK_URL) {
          return
        }

        if (file.type === "chunk") {
          let buildRelativeUrl
          const canBeHashed = file.facadeModuleId in jsModulesInHtml || !file.isEntry
          if (longTermCaching && useImportMapToImproveLongTermCaching) {
            if (canBeHashed) {
              buildRelativeUrl = computeBuildRelativeUrl(
                resolveUrl(fileName, buildDirectoryUrl),
                file.code,
                `[name]-[hash][extname]`,
              )
            } else {
              buildRelativeUrl = fileName
            }
          } else {
            buildRelativeUrl = fileName
            fileName = rollupFileNameWithoutHash(fileName)
          }

          if (canBeHashed) {
            markBuildRelativeUrlAsUsedByJs(buildRelativeUrl)
          }
          addFileNameMapping(fileName, buildRelativeUrl)
          jsBuild[buildRelativeUrl] = file
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
        const buildRelativeUrl = Object.keys(jsBuild).find((buildRelativeUrlCandidate) => {
          const file = jsBuild[buildRelativeUrlCandidate]
          const { facadeModuleId } = file
          return facadeModuleId && urlToServerUrl(facadeModuleId) === key
        })
        const file = jsBuild[buildRelativeUrl]
        const sourceAfterTransformation = file.code
        const fileName =
          useImportMapToImproveLongTermCaching || !longTermCaching
            ? buildRelativeUrlToFileName(buildRelativeUrl)
            : buildRelativeUrl

        logger.debug(`resolve rollup chunk ${shortenUrl(key)}`)
        rollupChunkReadyCallbackMap[key]({
          sourceAfterTransformation,
          buildRelativeUrl,
          fileName,
        })
      })
      // wait html files to be emitted
      await compositeAssetHandler.getAllAssetEntryEmittedPromise()

      const assetBuild = {}
      const buildRelativeUrlsToClean = compositeAssetHandler.getBuildRelativeUrlsToClean()
      Object.keys(rollupResult).forEach((fileName) => {
        const file = rollupResult[fileName]
        if (file.type !== "asset") {
          return
        }

        const buildRelativeUrl = fileNameToBuildRelativeUrl(fileName)
        // ignore potential useless assets which happens when:
        // - sourcemap re-emitted
        // - importmap re-emitted to have buildRelativeUrlMap
        if (buildRelativeUrlsToClean.includes(buildRelativeUrl)) {
          return
        }

        assetBuild[buildRelativeUrl] = file
      })

      rollupBuild = {
        ...jsBuild,
        ...assetBuild,
      }

      Object.keys(rollupBuild).forEach((buildRelativeUrl) => {
        const file = rollupBuild[buildRelativeUrl]

        if (file.type === "chunk") {
          const id = file.facadeModuleId
          if (id) {
            const originalProjectUrl = urlToOriginalProjectUrl(id)
            const originalProjectRelativeUrl = urlToRelativeUrl(
              originalProjectUrl,
              projectDirectoryUrl,
            )
            buildMappings[originalProjectRelativeUrl] = buildRelativeUrl
          } else {
            const sourcePath = file.map.sources[file.map.sources.length - 1]
            const fileBuildUrl = resolveUrl(file.fileName, buildDirectoryUrl)
            const originalProjectUrl = resolveUrl(sourcePath, fileBuildUrl)
            const originalProjectRelativeUrl = urlToRelativeUrl(
              originalProjectUrl,
              projectDirectoryUrl,
            )
            buildMappings[originalProjectRelativeUrl] = buildRelativeUrl
          }
        } else {
          const assetUrl = compositeAssetHandler.findAssetUrlByBuildRelativeUrl(buildRelativeUrl)
          if (assetUrl) {
            const originalProjectUrl = urlToOriginalProjectUrl(assetUrl)
            const originalProjectRelativeUrl = urlToRelativeUrl(
              originalProjectUrl,
              projectDirectoryUrl,
            )
            buildMappings[originalProjectRelativeUrl] = buildRelativeUrl
          } else {
            // the asset does not exists in the project it was generated during building
            // ici il est possible de trouver un asset ayant été redirigé ailleurs (sourcemap)
          }
        }
      })

      rollupBuild = sortObjectByPathnames(rollupBuild)
      buildManifest = sortObjectByPathnames(buildManifest)
      buildMappings = sortObjectByPathnames(buildMappings)

      if (manifestFile) {
        const manifestFileUrl = resolveUrl("manifest.json", buildDirectoryUrl)
        await writeFile(manifestFileUrl, JSON.stringify(buildManifest, null, "  "))
      }

      logger.info(createDetailedMessage(`build done`, formatBuildDoneDetails(rollupBuild)))

      if (writeOnFileSystem) {
        await Promise.all(
          Object.keys(rollupBuild).map(async (buildRelativeUrl) => {
            const file = rollupBuild[buildRelativeUrl]
            const fileBuildUrl = resolveUrl(buildRelativeUrl, buildDirectoryUrl)

            if (file.type === "chunk") {
              let fileCode = file.code
              if (file.map) {
                const sourcemapBuildRelativeUrl = `${buildRelativeUrl}.map`
                if (sourcemapBuildRelativeUrl in rollupBuild === false) {
                  const sourcemapBuildUrl = resolveUrl(sourcemapBuildRelativeUrl, buildDirectoryUrl)
                  const fileSourcemapString = JSON.stringify(file.map, null, "  ")
                  await writeFile(sourcemapBuildUrl, fileSourcemapString)

                  const sourcemapBuildUrlRelativeToFileBuildUrl = urlToRelativeUrl(
                    sourcemapBuildUrl,
                    fileBuildUrl,
                  )
                  fileCode = setJavaScriptSourceMappingUrl(
                    fileCode,
                    sourcemapBuildUrlRelativeToFileBuildUrl,
                  )
                }
              }
              await writeFile(fileBuildUrl, fileCode)
            } else {
              await writeFile(fileBuildUrl, file.source)
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
    markBuildRelativeUrlAsUsedByJs(importTarget.buildRelativeUrl)
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
        rollupBuild,
        urlResponseBodyMap,
        buildMappings,
        buildManifest,
        buildImportMap: createImportMapForFilesUsedInJs(),
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

const formatBuildDoneDetails = (build) => {
  const assetFilenames = Object.keys(build)
    .filter((key) => build[key].type === "asset")
    .map((key) => build[key].fileName)
  const assetCount = assetFilenames.length

  const chunkFilenames = Object.keys(build)
    .filter((key) => build[key].type === "chunk")
    .map((key) => build[key].fileName)
  const chunkCount = chunkFilenames.length

  const assetDescription =
    // eslint-disable-next-line no-nested-ternary
    assetCount === 0 ? "" : assetCount === 1 ? "1 asset" : `${assetCount} assets`
  const chunkDescription =
    // eslint-disable-next-line no-nested-ternary
    chunkCount === 0 ? "" : chunkCount === 1 ? "1 chunk" : `${chunkCount} chunks`

  return {
    ...(assetDescription ? { [assetDescription]: assetFilenames } : {}),
    ...(chunkDescription ? { [chunkDescription]: chunkFilenames } : {}),
  }
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

const injectImportedFilesIntoImportMapTarget = (importmapTarget, importMapToInject, minify) => {
  const { sourceAfterTransformation } = importmapTarget
  const importMapOriginal = JSON.parse(sourceAfterTransformation)

  const importMap = composeTwoImportMaps(importMapOriginal, importMapToInject)
  importmapTarget.updateOnceReady({
    sourceAfterTransformation: minify
      ? JSON.stringify(importMap)
      : JSON.stringify(importMap, null, "  "),
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
