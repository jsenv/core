/* eslint-disable import/max-dependencies */
import { extname } from "path"
import { normalizeImportMap, resolveImport } from "@jsenv/import-map"
import { loggerToLogLevel, createDetailedMessage } from "@jsenv/logger"
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
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/util"

// import { jsenvImportMetaResolveGlobalUrl } from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import {
  urlToServerUrl,
  urlToProjectUrl,
  urlToOriginalServerUrl,
  urlToOriginalProjectUrl,
  urlToCompiledServerUrl,
} from "@jsenv/core/src/internal/url-conversion.js"
import { fetchUrl } from "@jsenv/core/src/internal/fetchUrl.js"
import { validateResponseStatusIsOk } from "@jsenv/core/src/internal/validateResponseStatusIsOk.js"
import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
import {
  findFirstImportmapNode,
  getHtmlNodeLocation,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
} from "@jsenv/core/src/internal/compiling/compileHtml.js"
import { setJavaScriptSourceMappingUrl } from "@jsenv/core/src/internal/sourceMappingURLUtils.js"
import { sortObjectByPathnames } from "@jsenv/core/src/internal/building/sortObjectByPathnames.js"

import { parseTarget } from "./parseTarget.js"
import { showSourceLocation } from "./showSourceLocation.js"
import { isBareSpecifierForNativeNodeModule } from "./isBareSpecifierForNativeNodeModule.js"
import { fetchSourcemap } from "./fetchSourcemap.js"
import { createAssetBuilder, referenceToCodeForRollup } from "./asset-builder.js"
import { computeBuildRelativeUrl } from "./url-versioning.js"
import { transformImportMetaUrlReferences } from "./transformImportMetaUrlReferences.js"

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
  urlVersioning,
  useImportMapToImproveLongTermCaching,
  systemJsUrl,
  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
  assetManifestFile,
  assetManifestFileRelativeUrl,
  writeOnFileSystem,

  buildDirectoryUrl,
}) => {
  const urlImporterMap = {}
  const urlResponseBodyMap = {}
  const virtualModules = {}
  const urlRedirectionMap = {}
  const jsModulesInHtml = {}

  let lastErrorMessage
  const createJsenvPluginError = (message) => {
    const error = new Error(message)
    lastErrorMessage = message
    return error
  }

  const externalUrlPredicate = externalImportUrlPatternsToExternalUrlPredicate(
    externalImportUrlPatterns,
    projectDirectoryUrl,
  )

  // map fileName (build relative urls without hash) to build relative url
  let buildManifest = {}
  const buildRelativeUrlToFileName = (buildRelativeUrl) => {
    const fileName = Object.keys(buildManifest).find(
      (key) => buildManifest[key] === buildRelativeUrl,
    )
    return fileName
  }
  const buildRelativeUrlsUsedInJs = []
  const markBuildRelativeUrlAsUsedByJs = (buildRelativeUrl) => {
    buildRelativeUrlsUsedInJs.push(buildRelativeUrl)
    buildManifest[rollupFileNameWithoutHash(buildRelativeUrl)] = buildRelativeUrl
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

  const urlToUrlForRollup = (url) => {
    if (url.startsWith(`${compileServerOrigin}/`)) {
      return `${compileServerOriginForRollup}/${url.slice(`${compileServerOrigin}/`.length)}`
    }
    return url
  }

  const rollupUrlToServerUrl = (url) => {
    if (url.startsWith(`${compileServerOriginForRollup}/`)) {
      return `${compileServerOrigin}/${url.slice(`${compileServerOriginForRollup}/`.length)}`
    }
    return urlToServerUrl(url, { projectDirectoryUrl, compileServerOrigin })
  }

  const rollupUrlToProjectUrl = (url) => {
    return urlToProjectUrl(rollupUrlToServerUrl(url) || url, {
      projectDirectoryUrl,
      compileServerOrigin,
    })
  }

  const rollupUrlToOriginalServerUrl = (url) => {
    return urlToOriginalServerUrl(rollupUrlToServerUrl(url) || url, {
      projectDirectoryUrl,
      compileServerOrigin,
    })
  }

  const rollupUrlToOriginalProjectUrl = (url) => {
    return urlToOriginalProjectUrl(rollupUrlToServerUrl(url) || url, {
      projectDirectoryUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl,
    })
  }

  const rollupUrlToCompiledServerUrl = (url) => {
    return urlToCompiledServerUrl(url, {
      projectDirectoryUrl,
      compileServerOrigin,
      compileDirectoryRelativeUrl,
    })
  }

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

  const fetchAndNormalizeImportmap = async (importmapUrl, { allow404 = false } = {}) => {
    const importmapResponse = await fetchUrl(importmapUrl)
    if (allow404 && importmapResponse.status === 404) {
      return null
    }
    if (importmapResponse.status < 200 || importmapResponse.status > 299) {
      throw createJsenvPluginError(
        createDetailedMessage(`Unexpected response status for importmap.`, {
          ["response status"]: importmapResponse.status,
          ["response text"]: await importmapResponse.text(),
          ["importmap url"]: importmapUrl,
        }),
      )
    }
    const importmap = await importmapResponse.json()
    const importmapNormalized = normalizeImportMap(importmap, importmapUrl)
    return importmapNormalized
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

  let assetBuilder
  let rollupEmitFile = () => {}
  let rollupSetAssetSource = () => {}
  let fetchImportmap = fetchImportmapFromParameter
  let importMap

  const emitAsset = ({ fileName, source }) => {
    return rollupEmitFile({
      type: "asset",
      source,
      fileName,
    })
  }
  const emitChunk = (chunk) =>
    rollupEmitFile({
      type: "chunk",
      ...chunk,
    })
  const setAssetSource = (rollupReferenceId, assetSource) =>
    rollupSetAssetSource(rollupReferenceId, assetSource)

  const jsenvRollupPlugin = {
    name: "jsenv",

    async buildStart() {
      logger.info(
        createDetailedMessage(`start building project`, {
          ["project directory path"]: urlToFileSystemPath(projectDirectoryUrl),
          ["build directory path"]: urlToFileSystemPath(buildDirectoryUrl),
          ["entry point map"]: JSON.stringify(entryPointMap, null, "  "),
        }),
      )

      rollupEmitFile = (...args) => this.emitFile(...args)
      rollupSetAssetSource = (...args) => this.setAssetSource(...args)

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
                  logger.debug(formatUseImportMap(importmapHtmlNode, entryProjectUrl, htmlSource))
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
              entryBuffer: Buffer.from(htmlSource),
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
              entryBuffer: Buffer.from(await entryResponse.arrayBuffer()),
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
      assetBuilder = createAssetBuilder(
        {
          parse: async (target, notifiers) => {
            return parseTarget(target, notifiers, {
              urlToOriginalProjectUrl: rollupUrlToOriginalProjectUrl,
              urlToOriginalServerUrl: rollupUrlToOriginalServerUrl,
              format,
              systemJsUrl,
              useImportMapToImproveLongTermCaching,
              createImportMapForFilesUsedInJs,
              minify,
              minifyHtmlOptions,
              minifyCssOptions,
              minifyJsOptions,
            })
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
          urlToFileUrl: rollupUrlToProjectUrl,
          urlToCompiledServerUrl: rollupUrlToCompiledServerUrl,
          loadUrl: (url) => urlResponseBodyMap[url],
          resolveTargetUrl: ({
            targetSpecifier,
            targetIsJsModule,
            importerUrl,
            importerIsEntry,
            importerIsJsModule,
          }) => {
            const isHtmlEntryPoint = importerIsEntry && !importerIsJsModule
            const isHtmlEntryPointReferencingAJsModule = isHtmlEntryPoint && targetIsJsModule

            // when html references a js we must wait for the compiled version of js
            if (isHtmlEntryPointReferencingAJsModule) {
              const htmlCompiledUrl = rollupUrlToCompiledServerUrl(importerUrl)
              const jsModuleUrl = resolveUrl(targetSpecifier, htmlCompiledUrl)
              return jsModuleUrl
            }

            let targetUrl
            if (
              isHtmlEntryPoint &&
              // parse and handle the untransformed importmap, not the one from compile server
              !targetSpecifier.endsWith(".importmap")
            ) {
              const htmlCompiledUrl = rollupUrlToCompiledServerUrl(importerUrl)
              targetUrl = resolveUrl(targetSpecifier, htmlCompiledUrl)
            } else {
              targetUrl = resolveUrl(targetSpecifier, importerUrl)
            }
            // ignore url outside project directory
            // a better version would console.warn about file url outside projectDirectoryUrl
            // and ignore them and console.info/debug about remote url (https, http, ...)
            const projectUrl = rollupUrlToProjectUrl(targetUrl)
            if (!projectUrl) {
              return { external: true, url: targetUrl }
            }
            return targetUrl
          },
          emitChunk,
          emitAsset,
          setAssetSource,
          onJsModuleReferencedInHtml: ({ jsModuleUrl, jsModuleIsInline, jsModuleSource }) => {
            atleastOneChunkEmitted = true
            if (jsModuleIsInline) {
              virtualModules[jsModuleUrl] = jsModuleSource
            }
            jsModulesInHtml[urlToUrlForRollup(jsModuleUrl)] = true
          },
        },
      )

      await Promise.all(
        entryPointsPrepared.map(
          async ({
            entryContentType,
            entryProjectRelativeUrl,
            entryBuildRelativeUrl,
            entryBuffer,
          }) => {
            if (entryContentType === "text/html") {
              const entryUrl = resolveUrl(entryProjectRelativeUrl, compileServerOrigin)
              await assetBuilder.createReferenceForHTMLEntry({
                entryContentType,
                entryUrl,
                entryBuffer,
                entryBuildRelativeUrl,
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
              console.warn(
                `entry content type ${entryProjectRelativeUrl} is unusual, got ${entryContentType}`,
              )
              const entryUrl = resolveUrl(entryProjectRelativeUrl, compileServerOrigin)
              await assetBuilder.createReferenceForHTMLEntry({
                entryContentType,
                entryUrl,
                entryBuffer,
                entryBuildRelativeUrl,
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
        importer = rollupUrlToServerUrl(importer)
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
      const importProjectUrl = rollupUrlToProjectUrl(importUrl)
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

    resolveFileUrl: ({
      // chunkId, moduleId, referenceId,
      fileName,
    }) => {
      const assetTarget = assetBuilder.getAssetByUrl(fileName)
      const buildRelativeUrl = assetTarget ? assetTarget.targetBuildRelativeUrl : fileName
      if (format === "esmodule") {
        return `new URL("${buildRelativeUrl}", import.meta.url).href`
      }
      if (format === "systemjs") {
        return `System.resolve("./${buildRelativeUrl}", module.meta.url)`
      }
      if (format === "global") {
        return `new URL("${buildRelativeUrl}", document.currentScript && document.currentScript.src || document.baseURI).href`
      }
      if (format === "commonjs") {
        return `new URL("${buildRelativeUrl}", "file:///" + __filename.replace(/\\/g, "/")).href`
      }
      return null
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {

    // },

    async load(id) {
      if (id === EMPTY_CHUNK_URL) {
        return ""
      }

      const moduleInfo = this.getModuleInfo(id)
      const url = rollupUrlToServerUrl(id)

      // const originalProjectUrl = urlToOriginalProjectUrl(url)
      // if (originalProjectUrl === jsenvImportMetaResolveGlobalUrl) {
      //   await assetBuilder.createReferenceForJs({
      //     jsUrl: url,

      //     targetSpecifier: importMapFileRelativeUrl,
      //     targetContentType: "application/importmap+json",
      //     // targetBuffer,
      //   })
      // }

      logger.debug(`loads ${url}`)
      const { responseUrl, contentRaw, content = "", map } = await loadModule(url, {
        moduleInfo,
      })

      saveUrlResponseBody(responseUrl, contentRaw)
      // handle redirection
      if (responseUrl !== url) {
        saveUrlResponseBody(url, contentRaw)
        urlRedirectionMap[url] = responseUrl
      }

      return { code: content, map }
    },

    async transform(code, id) {
      const ast = this.parse(code, {
        // used to know node line and column
        locations: true,
      })
      // const moduleInfo = this.getModuleInfo(id)
      const url = rollupUrlToServerUrl(id)
      const importerUrl = urlImporterMap[url]
      return transformImportMetaUrlReferences({
        url,
        importerUrl,
        code,
        ast,
        assetBuilder,
        fetch: fetchModule,
        markBuildRelativeUrlAsUsedByJs,
      })
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
        useImportMapToImproveLongTermCaching || !urlVersioning
          ? `[name]${outputExtension}`
          : `[name]-[hash]${outputExtension}`

      // rollup does not expects to have http dependency in the mix: fix them
      outputOptions.sourcemapPathTransform = (relativePath, sourcemapPath) => {
        const sourcemapUrl = fileSystemPathToUrl(sourcemapPath)
        const url = relativePathToUrl(relativePath, sourcemapUrl)
        const serverUrl = rollupUrlToServerUrl(url)
        const finalUrl = serverUrl in urlRedirectionMap ? urlRedirectionMap[serverUrl] : serverUrl
        const projectUrl = rollupUrlToProjectUrl(finalUrl)

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
        if (file.type !== "chunk") {
          return
        }

        if (file.facadeModuleId === EMPTY_CHUNK_URL) {
          return
        }

        let buildRelativeUrl
        const canBeVersioned = file.facadeModuleId in jsModulesInHtml || !file.isEntry
        if (urlVersioning && useImportMapToImproveLongTermCaching) {
          if (canBeVersioned) {
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

        let originalProjectUrl
        const id = file.facadeModuleId
        if (id) {
          originalProjectUrl = urlToOriginalProjectUrl(id)
        } else {
          const sourcePath = file.map.sources[file.map.sources.length - 1]
          const fileBuildUrl = resolveUrl(file.fileName, buildDirectoryUrl)
          originalProjectUrl = resolveUrl(sourcePath, fileBuildUrl)
        }
        const originalProjectRelativeUrl = urlToRelativeUrl(originalProjectUrl, projectDirectoryUrl)

        if (canBeVersioned) {
          markBuildRelativeUrlAsUsedByJs(buildRelativeUrl)
        }
        jsBuild[buildRelativeUrl] = file
        buildManifest[fileName] = buildRelativeUrl
        buildMappings[originalProjectRelativeUrl] = buildRelativeUrl
      })

      // it's important to do this to emit late asset
      rollupEmitFile = (...args) => this.emitFile(...args)
      rollupSetAssetSource = (...args) => this.setAssetSource(...args)

      // malheureusement rollup ne permet pas de savoir lorsqu'un chunk
      // a fini d'etre résolu (parsing des imports statiques et dynamiques recursivement)
      // donc lorsque le build se termine on va indiquer
      // aux assets faisant référence a ces chunk js qu'ils sont terminés
      // et donc les assets peuvent connaitre le nom du chunk
      // et mettre a jour leur dépendance vers ce fichier js
      const rollupChunkReadyCallbackMap = assetBuilder.getRollupChunkReadyCallbackMap()
      Object.keys(rollupChunkReadyCallbackMap).forEach((key) => {
        const targetBuildRelativeUrl = Object.keys(jsBuild).find((buildRelativeUrlCandidate) => {
          const file = jsBuild[buildRelativeUrlCandidate]
          const { facadeModuleId } = file
          return facadeModuleId && rollupUrlToServerUrl(facadeModuleId) === key
        })
        const file = jsBuild[targetBuildRelativeUrl]
        const targetBuildBuffer = file.code
        const targetFileName =
          useImportMapToImproveLongTermCaching || !urlVersioning
            ? buildRelativeUrlToFileName(targetBuildRelativeUrl)
            : targetBuildRelativeUrl

        logger.debug(`resolve rollup chunk ${shortenUrl(key)}`)
        rollupChunkReadyCallbackMap[key]({
          targetBuildBuffer,
          targetBuildRelativeUrl,
          targetFileName,
        })
      })
      // wait html files to be emitted
      await assetBuilder.getAllAssetEntryEmittedPromise()

      const assetBuild = {}
      Object.keys(rollupResult).forEach((rollupFileId) => {
        const file = rollupResult[rollupFileId]
        if (file.type !== "asset") {
          return
        }

        const assetTarget = assetBuilder.getAssetByUrl(rollupFileId)
        if (!assetTarget) {
          const buildRelativeUrl = rollupFileId
          const fileName = rollupFileNameWithoutHash(buildRelativeUrl)
          assetBuild[buildRelativeUrl] = file
          buildManifest[fileName] = buildRelativeUrl
          // the asset does not exists in the project it was generated during building
          // happens for sourcemap
          return
        }

        // ignore potential useless assets which happens when:
        // - sourcemap re-emitted
        // - importmap re-emitted to have buildRelativeUrlMap
        if (assetTarget.shouldBeIgnored) {
          return
        }

        const buildRelativeUrl = assetTarget.targetBuildRelativeUrl
        const fileName = rollupFileNameWithoutHash(buildRelativeUrl)
        const originalProjectUrl = urlToOriginalProjectUrl(rollupFileId)
        const originalProjectRelativeUrl = urlToRelativeUrl(originalProjectUrl, projectDirectoryUrl)
        // in case sourcemap is mutated, we must not trust rollup but the asset builder source instead
        file.source = String(assetTarget.targetBuildBuffer)

        assetBuild[buildRelativeUrl] = file
        buildMappings[originalProjectRelativeUrl] = buildRelativeUrl
        buildManifest[fileName] = buildRelativeUrl
      })

      rollupBuild = {
        ...jsBuild,
        ...assetBuild,
      }

      rollupBuild = sortObjectByPathnames(rollupBuild)
      buildManifest = sortObjectByPathnames(buildManifest)
      buildMappings = sortObjectByPathnames(buildMappings)

      if (assetManifestFile) {
        const assetManifestFileUrl = resolveUrl(assetManifestFileRelativeUrl, buildDirectoryUrl)
        await writeFile(assetManifestFileUrl, JSON.stringify(buildManifest, null, "  "))
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
    const projectUrl = rollupUrlToProjectUrl(url)
    if (projectUrl && projectUrl !== url) {
      urlResponseBodyMap[projectUrl] = responseBody
    }
  }

  const loadModule = async (
    moduleUrl,
    // {
    //   moduleInfo
    // },
  ) => {
    if (moduleUrl in virtualModules) {
      const codeInput = virtualModules[moduleUrl]

      const { code, map } = await transformJs({
        projectDirectoryUrl,
        importMetaEnvFileRelativeUrl,
        code: codeInput,
        url: rollupUrlToProjectUrl(moduleUrl), // transformJs expect a file:// url
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
      rollupUrlToProjectUrl(importerUrl) || importerUrl,
    )
    const contentType = moduleResponse.headers["content-type"] || ""
    const commonData = {
      responseUrl: moduleResponse.url,
    }

    // keep this in sync with module-registration.js
    if (contentType === "application/javascript" || contentType === "text/javascript") {
      const jsModuleString = await moduleResponse.text()
      const map = await fetchSourcemap(moduleUrl, jsModuleString, {
        cancellationToken,
        logger,
      })

      return {
        ...commonData,
        contentRaw: jsModuleString,
        content: jsModuleString,
        map,
      }
    }

    if (contentType === "application/json" || contentType.endsWith("+json")) {
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

    const moduleResponseBodyAsBuffer = Buffer.from(await moduleResponse.arrayBuffer())
    const targetContentType = moduleResponse.headers["content-type"]
    const assetReferenceForImport = await assetBuilder.createReferenceForJs({
      // Reference to this target is corresponds to a static or dynamic import.
      // found in a given file (importerUrl).
      // But we don't know the line and colum because rollup
      // does not tell us that information
      jsUrl: importerUrl,
      jsLine: undefined,
      jsColumn: undefined,

      targetSpecifier: moduleResponse.url,
      targetContentType,
      targetBuffer: moduleResponseBodyAsBuffer,
    })
    if (assetReferenceForImport) {
      markBuildRelativeUrlAsUsedByJs(assetReferenceForImport.target.targetBuildRelativeUrl)
      const content = `export default ${referenceToCodeForRollup(assetReferenceForImport)}`

      return {
        ...commonData,
        contentRaw: String(moduleResponseBodyAsBuffer),
        content,
      }
    }

    return {
      ...commonData,
      contentRaw: String(moduleResponseBodyAsBuffer),
      content: String(moduleResponseBodyAsBuffer),
    }
  }

  const fetchModule = async (moduleUrl, importer) => {
    const response = await fetchUrl(moduleUrl, {
      cancellationToken,
      ignoreHttpsError: true,
    })

    importer = urlToOriginalProjectUrl(importer) || rollupUrlToProjectUrl(importer) || importer

    if (response.status === 404) {
      throw createJsenvPluginError(
        formatFileNotFound(
          urlToOriginalProjectUrl(response.url) ||
            rollupUrlToProjectUrl(response.url) ||
            response.url,
          importer,
        ),
      )
    }

    const okValidation = await validateResponseStatusIsOk(response, importer)

    if (!okValidation.valid) {
      throw createJsenvPluginError(okValidation.message)
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
    getLastErrorMessage: () => lastErrorMessage,
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
  return createDetailedMessage(`A file cannot be found.`, {
    file: urlToFileSystemPath(url),
    ["imported by"]:
      importer.startsWith("file://") && !importer.includes("\n")
        ? urlToFileSystemPath(importer)
        : importer,
  })
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

const rollupFileNameWithoutHash = (fileName) => {
  return fileName.replace(/-[a-z0-9]{8,}(\..*?)?$/, (_, afterHash = "") => {
    return afterHash
  })
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
  const externalImportUrlStructuredMetaMap = normalizeStructuredMetaMap(
    {
      external: {
        ...externalImportUrlPatterns,
        "node_modules/@jsenv/core/helpers/": false,
      },
    },
    projectDirectoryUrl,
  )
  return (url) => {
    const meta = urlToMeta({
      url,
      structuredMetaMap: externalImportUrlStructuredMetaMap,
    })
    return Boolean(meta.external)
  }
}
