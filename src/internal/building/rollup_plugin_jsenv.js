import { extname } from "node:path"
import MagicString from "magic-string"
import { normalizeImportMap } from "@jsenv/importmap"
import { isSpecifierForNodeCoreModule } from "@jsenv/importmap/src/isSpecifierForNodeCoreModule.js"
import { createDetailedMessage, loggerToLogLevel } from "@jsenv/logger"
import {
  isFileSystemPath,
  fileSystemPathToUrl,
  resolveUrl,
  urlToRelativeUrl,
  resolveDirectoryUrl,
  comparePathnames,
  urlIsInsideOf,
  normalizeStructuredMetaMap,
  urlToMeta,
} from "@jsenv/filesystem"
import { UNICODE } from "@jsenv/log"

import { transformJs } from "@jsenv/core/src/internal/compiling/js-compilation-service/transformJs.js"
import { createUrlConverter } from "@jsenv/core/src/internal/url_conversion.js"
import { createUrlFetcher } from "@jsenv/core/src/internal/building/url_fetcher.js"
import { createUrlLoader } from "@jsenv/core/src/internal/building/url_loader.js"
import { stringifyUrlTrace } from "@jsenv/core/src/internal/building/url_trace.js"
import { sortObjectByPathnames } from "@jsenv/core/src/internal/building/sortObjectByPathnames.js"
import { jsenvHelpersDirectoryInfo } from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import { setUrlSearchParamsDescriptor } from "@jsenv/core/src/internal/url_utils.js"

import {
  formatBuildStartLog,
  formatUseImportMapFromHtml,
  formatImportmapOutsideCompileDirectory,
  formatRessourceHintNeverUsedWarning,
  formatBuildDoneInfo,
} from "./build_logs.js"
import { importMapsFromHtml } from "./html/htmlScan.js"
import { parseRessource } from "./parseRessource.js"
import {
  createRessourceBuilder,
  referenceToCodeForRollup,
} from "./ressource_builder.js"

import { createUrlVersioner } from "./url_versioning.js"
import { visitImportReferences } from "./import_references.js"

import { createImportResolverForNode } from "../import-resolution/import-resolver-node.js"
import { createImportResolverForImportmap } from "../import-resolution/import-resolver-importmap.js"
import { getDefaultImportMap } from "../import-resolution/importmap-default.js"
import { injectSourcemapInRollupBuild } from "./rollup_build_sourcemap.js"
import { createBuildStats } from "./build_stats.js"

export const createRollupPlugins = async ({
  buildOperation,
  logger,

  projectDirectoryUrl,
  entryPointMap,
  compileServerOrigin,
  compileDirectoryRelativeUrl,
  buildDirectoryUrl,

  urlMappings,
  importResolutionMethod,
  importMapFileRelativeUrl,
  importDefaultExtension,
  externalImportSpecifiers,
  externalImportUrlPatterns,
  importPaths,
  workers,
  serviceWorkers,
  serviceWorkerFinalizer,
  classicWorkers,
  classicServiceWorkers,

  format,
  systemJsUrl,
  babelPluginMap,
  node,
  importAssertionsSupport,

  urlVersioning,
  urlVersionningForEntryPoints,
  lineBreakNormalization,
  jsConcatenation,
  cssConcatenation,
  useImportMapToMaximizeCacheReuse,

  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
}) => {
  const urlImporterMap = {}
  const inlineModuleScripts = {}
  const jsModulesFromEntry = {}
  const buildFileContents = {}
  const buildInlineFileContents = {}
  let buildStats = {}
  const buildStartMs = Date.now()

  let lastErrorMessage
  const storeLatestJsenvPluginError = (error) => {
    lastErrorMessage = error.message
  }

  const workerUrls = {}
  Object.keys(workers).forEach((key) => {
    const url = resolveUrl(key, projectDirectoryUrl)
    workerUrls[url] = workers[key]
  })
  const serviceWorkerUrls = {}
  Object.keys(serviceWorkers).forEach((key) => {
    const url = resolveUrl(key, projectDirectoryUrl)
    serviceWorkerUrls[url] = serviceWorkers[key]
  })
  const classicWorkerUrls = {}
  Object.keys(classicWorkers).forEach((key) => {
    const url = resolveUrl(key, projectDirectoryUrl)
    classicWorkerUrls[url] = classicWorkers[key]
  })
  const classicServiceWorkerUrls = {}
  Object.keys(classicServiceWorkers).forEach((key) => {
    const url = resolveUrl(key, projectDirectoryUrl)
    classicServiceWorkerUrls[url] = classicServiceWorkers[key]
  })

  let ressourceBuilder
  let importResolver
  let rollupEmitFile = () => {}
  let rollupSetAssetSource = () => {}
  let _rollupGetModuleInfo = () => {}
  const rollupGetModuleInfo = (id) => _rollupGetModuleInfo(id)

  const urlVersioner = createUrlVersioner({
    urlVersionningForEntryPoints,
    entryPointMap,
    workerUrls,
    asOriginalUrl,
    lineBreakNormalization,
  })

  const {
    asRollupUrl,
    asProjectUrl,
    asServerUrl,
    asCompiledServerUrl,
    asOriginalUrl,
    asOriginalServerUrl,
    applyUrlMappings,
  } = createUrlConverter({
    projectDirectoryUrl,
    compileServerOrigin,
    compileDirectoryRelativeUrl,
    urlMappings,
  })

  const urlFetcher = createUrlFetcher({
    asOriginalUrl,
    asProjectUrl,
    applyUrlMappings,
    urlImporterMap,
    beforeThrowingResponseValidationError: (error) => {
      storeLatestJsenvPluginError(error)
    },
  })

  const urlLoader = createUrlLoader({
    projectDirectoryUrl,
    buildDirectoryUrl,
    babelPluginMap,
    allowJson: acceptsJsonContentType({ node, format }),
    urlImporterMap,
    inlineModuleScripts,
    jsConcatenation,

    asServerUrl,
    asProjectUrl,
    asOriginalUrl,

    urlFetcher,
  })

  const externalUrlPredicate = externalImportUrlPatternsToExternalUrlPredicate(
    externalImportUrlPatterns,
    projectDirectoryUrl,
  )

  // map build relative urls without hash (called "ressourceName") to real build relative urls
  let buildManifest = {}
  const ressourceNameFromBuildRelativeUrl = (buildRelativeUrl) => {
    const ressourceName = Object.keys(buildManifest).find(
      (key) => buildManifest[key] === buildRelativeUrl,
    )
    return ressourceName
  }

  const ressourcesReferencedByJs = []
  const createImportMapForFilesUsedInJs = async () => {
    // wait for asset build relative urls
    // to ensure the importmap will contain remappings for them
    await Promise.all(
      ressourcesReferencedByJs.map(async (ressourceName) => {
        const ressource = ressourceBuilder.findRessource((ressource) => {
          return ressource.relativeUrl === ressourceName
        })
        if (ressource && !ressource.isJsModule) {
          await ressource.getReadyPromise()
          buildManifest[ressourceName] = ressource.buildRelativeUrl
        }
      }),
    )

    const topLevelMappings = {}
    ressourcesReferencedByJs.sort(comparePathnames).forEach((ressourceName) => {
      const buildRelativeUrl = buildManifest[ressourceName]
      if (
        ressourceName &&
        buildRelativeUrl &&
        ressourceName !== buildRelativeUrl
      ) {
        topLevelMappings[`./${ressourceName}`] = `./${buildRelativeUrl}`
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

  const EMPTY_CHUNK_URL = resolveUrl("__empty__", projectDirectoryUrl)

  const compileDirectoryUrl = resolveDirectoryUrl(
    compileDirectoryRelativeUrl,
    projectDirectoryUrl,
  )
  const compileDirectoryServerUrl = resolveDirectoryUrl(
    compileDirectoryRelativeUrl,
    compileServerOrigin,
  )

  const emitAsset = ({ fileName, source }) => {
    return rollupEmitFile({
      type: "asset",
      source,
      fileName,
    })
  }
  // rollup expects an input option, if we provide only an html file
  // without any script type module in it, we won't emit "chunk" and rollup will throw.
  // It is valid to build an html not referencing any js (rare but valid)
  // In that case jsenv emits an empty chunk and discards rollup warning about it
  // This chunk is later ignored in "generateBundle" hook
  let atleastOneChunkEmitted = false
  const emitChunk = (chunk) => {
    atleastOneChunkEmitted = true
    return rollupEmitFile({
      type: "chunk",
      ...chunk,
    })
  }
  const setAssetSource = (rollupReferenceId, assetSource) => {
    return rollupSetAssetSource(rollupReferenceId, assetSource)
  }

  let onBundleEnd = () => {}
  let minifyJs
  let minifyHtml

  const rollupPlugins = []
  // When format is systemjs, rollup add async/await
  // that might be unsupported by the runtime.
  // in that case we have to transform the rollup output
  if (babelPluginMap["transform-async-to-promises"] && format === "systemjs") {
    rollupPlugins.push({
      name: "jsenv_fix_async_await",
      async renderChunk(code, chunk) {
        let map = chunk.map
        const result = await transformJs({
          code,
          url: chunk.facadeModuleId
            ? asOriginalUrl(chunk.facadeModuleId)
            : resolveUrl(chunk.fileName, buildDirectoryUrl),
          projectDirectoryUrl,
          babelPluginMap: {
            "transform-async-to-promises":
              babelPluginMap["transform-async-to-promises"],
          },
          // pass undefined when format is "systemjs" to avoid
          // re-wrapping the code in systemjs format
          moduleOutFormat: undefined,
          babelHelpersInjectionAsImport: false,
          transformGenerator: false,
        })
        code = result.code
        map = result.map
        return {
          code,
          map,
        }
      },
    })
  }
  if (minify) {
    const methodHooks = {
      minifyJs: async (...args) => {
        const { minifyJs } = await import("./js/minifyJs.js")
        return minifyJs(...args)
      },
      minifyHtml: async (...args) => {
        const { minifyHtml } = await import("./html/minifyHtml.js")
        return minifyHtml(...args)
      },
    }

    minifyJs = async ({ url, code, map, ...rest }) => {
      const result = await methodHooks.minifyJs({
        url,
        code,
        map,
        ...minifyJsOptions,
        ...rest,
      })
      return {
        code: result.code,
        map: result.map,
      }
    }

    minifyHtml = async (html) => {
      return methodHooks.minifyHtml(html, minifyHtmlOptions)
    }

    rollupPlugins.push({
      name: "jsenv_minifier",
      async renderChunk(code, chunk) {
        let map = chunk.map
        const result = await minifyJs({
          url: chunk.facadeModuleId
            ? asOriginalUrl(chunk.facadeModuleId)
            : resolveUrl(chunk.fileName, buildDirectoryUrl),
          code,
          map,
          ...(format === "global" ? { toplevel: false } : { toplevel: true }),
        })

        code = result.code
        map = result.map
        return {
          code,
          map,
        }
      },
    })
  }
  rollupPlugins.unshift({
    name: "jsenv",

    async buildStart() {
      logger.info(formatBuildStartLog({ entryPointMap }))

      const entryPointsPrepared = await prepareEntryPoints(entryPointMap, {
        logger,
        projectDirectoryUrl,
        buildDirectoryUrl,
        compileServerOrigin,
        urlFetcher,
      })
      const htmlEntryPoints = entryPointsPrepared.filter(
        (entryPointPrepared) => {
          return entryPointPrepared.entryContentType === "text/html"
        },
      )
      const htmlEntryPointCount = htmlEntryPoints.length
      if (node && htmlEntryPointCount > 0) {
        logger.warn(
          `WARNING: Found an HTML entry point and "node" is part of "runtimeSupport", it's not supposed to happen`,
        )
      }
      if (htmlEntryPointCount > 1) {
        const error = new Error(
          `Cannot handle more than one html entry point, got ${htmlEntryPointCount}`,
        )
        storeLatestJsenvPluginError(error)
        throw error
      }

      if (typeof useImportMapToMaximizeCacheReuse === "undefined") {
        useImportMapToMaximizeCacheReuse =
          htmlEntryPointCount > 0 &&
          // node has no importmap concept, let's use the versionned url in that case
          !node
      }

      // https://github.com/easesu/rollup-plugin-html-input/blob/master/index.js
      // https://rollupjs.org/guide/en/#thisemitfileemittedfile-emittedchunk--emittedasset--string
      rollupEmitFile = (...args) => this.emitFile(...args)
      rollupSetAssetSource = (...args) => this.setAssetSource(...args)
      _rollupGetModuleInfo = (id) => this.getModuleInfo(id)

      let importMapInfoFromHtml = null
      if (htmlEntryPointCount === 1) {
        const htmlEntryPoint = htmlEntryPoints[0]
        const htmlSource = String(htmlEntryPoint.entryBuffer)

        const importMaps = importMapsFromHtml(htmlSource)
        const importMapCount = importMaps.length
        if (importMapCount > 1) {
          const error = new Error(`Many importmap found in html file`)
          storeLatestJsenvPluginError(error)
          throw error
        }

        if (importMapCount === 1) {
          const htmlUrl = resolveUrl(
            htmlEntryPoint.entryProjectRelativeUrl,
            projectDirectoryUrl,
          )
          importMapInfoFromHtml = {
            ...importMaps[0],
            htmlUrl,
            htmlSource,
          }
        }
      }

      if (importResolutionMethod === "node") {
        importResolver = await createImportResolverForNode({
          projectDirectoryUrl,
          compileServerOrigin,
          compileDirectoryRelativeUrl,
          importDefaultExtension,
        })
      } else {
        let importMap
        let importMapUrl
        let fetchImportMap
        if (importMapInfoFromHtml) {
          logger.debug(formatUseImportMapFromHtml(importMapInfoFromHtml))

          if (importMapInfoFromHtml.type === "remote") {
            importMapUrl = resolveUrl(
              importMapInfoFromHtml.src,
              asCompiledServerUrl(importMapInfoFromHtml.htmlUrl),
            )
            importMapUrl = applyUrlMappings(importMapUrl)

            if (!urlIsInsideOf(importMapUrl, compileDirectoryServerUrl)) {
              logger.warn(
                formatImportmapOutsideCompileDirectory({
                  importMapInfo: importMapInfoFromHtml,
                  compileDirectoryUrl,
                }),
              )
            }

            fetchImportMap = () => {
              return fetchImportMapFromUrl(
                importMapUrl,
                importMapInfoFromHtml.htmlUrl,
              )
            }
          } else {
            const firstHtmlEntryPoint = htmlEntryPoints[0]
            const htmlProjectRelativeUrl =
              firstHtmlEntryPoint.entryProjectRelativeUrl
            const htmlCompiledUrl = resolveUrl(
              htmlProjectRelativeUrl,
              compileDirectoryServerUrl,
            )
            importMapUrl = htmlCompiledUrl
            fetchImportMap = () => {
              const importMapRaw = JSON.parse(importMapInfoFromHtml.text)
              const importMap = normalizeImportMap(importMapRaw, importMapUrl)
              return importMap
            }
          }
        } else if (importMapFileRelativeUrl) {
          importMapUrl = resolveUrl(
            importMapFileRelativeUrl,
            compileDirectoryServerUrl,
          )
          fetchImportMap = () => {
            return fetchImportMapFromUrl(
              importMapUrl,
              "importMapFileRelativeUrl parameter",
            )
          }
        } else {
          // there is no importmap, it's fine, it's not mandatory
          fetchImportMap = () => {
            const firstEntryPoint = htmlEntryPoints[0] || entryPointsPrepared[0]
            const { entryProjectRelativeUrl } = firstEntryPoint
            const entryCompileUrl = resolveUrl(
              entryProjectRelativeUrl,
              compileDirectoryUrl,
            )
            const defaultImportMap = getDefaultImportMap({
              importMapFileUrl: entryCompileUrl,
              projectDirectoryUrl,
              compileDirectoryRelativeUrl,
            })
            const entryCompileServerUrl = resolveUrl(
              entryProjectRelativeUrl,
              compileDirectoryServerUrl,
            )
            return normalizeImportMap(defaultImportMap, entryCompileServerUrl)
          }
        }

        try {
          importMap = await fetchImportMap()
        } catch (e) {
          storeLatestJsenvPluginError(e)
          throw e
        }
        importResolver = await createImportResolverForImportmap({
          compileServerOrigin,
          compileDirectoryRelativeUrl,
          importMap,
          importMapUrl,
          importDefaultExtension,
          onBareSpecifierError: (error) => {
            storeLatestJsenvPluginError(error)
          },
        })
      }

      ressourceBuilder = createRessourceBuilder(
        {
          urlFetcher,
          urlLoader,
          parseRessource: async (ressource, notifiers) => {
            return parseRessource(ressource, notifiers, {
              format,
              systemJsUrl,
              projectDirectoryUrl,
              asProjectUrl,
              asOriginalUrl,
              asOriginalServerUrl,
              ressourceHintNeverUsedCallback: (linkInfo) => {
                logger.warn(formatRessourceHintNeverUsedWarning(linkInfo))
              },
              useImportMapToMaximizeCacheReuse,
              createImportMapForFilesUsedInJs,
              minify,
              minifyJs,
              minifyHtml,
              minifyCssOptions,
              cssConcatenation,
            })
          },
        },
        {
          logLevel: loggerToLogLevel(logger),
          format,
          // projectDirectoryUrl,
          compileServerOrigin,
          buildDirectoryUrl,

          asOriginalServerUrl,
          urlToCompiledServerUrl: (url) => {
            return asCompiledServerUrl(url)
          },
          urlToHumanUrl: (url) => {
            if (
              !url.startsWith("http:") &&
              !url.startsWith("https:") &&
              !url.startsWith("file:")
            ) {
              return url
            }
            return asOriginalUrl(url) || url
          },
          resolveRessourceUrl: ({
            ressourceSpecifier,
            isJsModule,
            // isRessourceHint,
            ressourceImporter,
          }) => {
            // Entry point is not a JS module and references a js module (html referencing js)
            if (
              ressourceImporter.isEntryPoint &&
              !ressourceImporter.isJsModule &&
              isJsModule
            ) {
              const importerCompiledUrl = asCompiledServerUrl(
                ressourceImporter.url,
              )
              const jsModuleUrl = resolveUrl(
                ressourceSpecifier,
                importerCompiledUrl,
              )
              return jsModuleUrl
            }

            let ressourceUrl
            if (
              ressourceImporter.isEntryPoint &&
              !ressourceImporter.isJsModule
            ) {
              // Entry point (likely html, unlikely css) is referecing a ressource
              // when importmap, parse the original importmap ressource
              if (ressourceSpecifier.endsWith(".importmap")) {
                ressourceUrl = resolveUrl(
                  ressourceSpecifier,
                  ressourceImporter.url,
                )
              } else {
                const importerCompiled = asCompiledServerUrl(
                  ressourceImporter.url,
                )
                ressourceUrl = resolveUrl(ressourceSpecifier, importerCompiled)
              }
            } else {
              ressourceUrl = resolveUrl(
                ressourceSpecifier,
                ressourceImporter.url,
              )
            }

            // ignore url outside project directory
            // a better version would console.warn about file url outside projectDirectoryUrl
            // and ignore them and console.info/debug about remote url (https, http, ...)
            const projectUrl = asProjectUrl(ressourceUrl)
            if (!projectUrl) {
              return {
                isExternal: true,
                url: ressourceUrl,
              }
            }

            const originalUrl = asOriginalUrl(projectUrl)
            const workerBuildRelativeUrl = workerUrls[originalUrl]
            if (workerBuildRelativeUrl) {
              return {
                isWorker: true,
                isJsModule: true,
                url: ressourceUrl,
              }
            }
            const serviceWorkerBuildRelativeUrl = serviceWorkerUrls[originalUrl]
            if (serviceWorkerBuildRelativeUrl) {
              return {
                isServiceWorker: true,
                isJsModule: true,
                url: ressourceUrl,
              }
            }
            const classicWorkerBuildRelativeUrl = classicWorkerUrls[originalUrl]
            if (classicWorkerBuildRelativeUrl) {
              return {
                isWorker: true,
                url: ressourceUrl,
              }
            }
            const classicServiceWorkerBuildRelativeUrl =
              classicServiceWorkerUrls[originalUrl]
            if (classicServiceWorkerBuildRelativeUrl) {
              return {
                isServiceWorker: true,
                url: ressourceUrl,
              }
            }

            return ressourceUrl
          },
          onJsModule: ({ ressource, jsModuleUrl, jsModuleIsInline }) => {
            if (jsModuleIsInline) {
              inlineModuleScripts[jsModuleUrl] = ressource
            }

            urlImporterMap[jsModuleUrl] = {
              url: resolveUrl(
                entryPointsPrepared[0].entryProjectRelativeUrl,
                compileDirectoryServerUrl,
              ),
              line: undefined,
              column: undefined,
            }
            jsModulesFromEntry[asRollupUrl(jsModuleUrl)] = true
            const fileName = ressource.relativeUrl
            const rollupReferenceId = emitChunk({
              id: asRollupUrl(jsModuleUrl),
              fileName,
            })
            return {
              fileName,
              rollupReferenceId,
            }
          },
          onAsset: ({ ressource }) => {
            const fileName = ressource.relativeUrl
            const rollupReferenceId = emitAsset({
              name: ressource.name,
              fileName,
            })
            return {
              rollupReferenceId,
              fileName,
            }
          },
          onAssetSourceUpdated: ({ ressource }) => {
            setAssetSource(
              ressource.rollupReferenceId,
              ressource.bufferAfterBuild,
            )
          },
          urlVersioner,
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
            if (entryContentType === "application/javascript") {
              emitChunk({
                id: ensureRelativeUrlNotation(entryProjectRelativeUrl),
                fileName: entryBuildRelativeUrl,
              })
              return
            }

            if (
              entryContentType !== "text/html" &&
              entryContentType !== "text/css"
            ) {
              logger.warn(
                `Unusual content type for entry point, got "${entryContentType}" for ${entryProjectRelativeUrl}`,
              )
            }
            const entryUrl =
              entryContentType === "text/html"
                ? resolveUrl(entryProjectRelativeUrl, compileServerOrigin)
                : resolveUrl(entryProjectRelativeUrl, compileDirectoryServerUrl)
            await ressourceBuilder.createReferenceForEntryPoint({
              entryContentType,
              entryUrl,
              entryBuffer,
            })
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

    async resolveId(specifier, importer, { custom }) {
      if (importer === undefined) {
        if (specifier.endsWith(".html")) {
          importer = compileServerOrigin
        } else {
          importer = compileDirectoryServerUrl
        }
      } else {
        importer = asServerUrl(importer)
      }

      const { importAssertionInfo } = custom
      const onExternal = ({ specifier, reason }) => {
        logger.debug(`${specifier} marked as external (reason: ${reason})`)
      }

      if (node && isSpecifierForNodeCoreModule(specifier)) {
        onExternal({
          specifier,
          reason: `node builtin module`,
        })
        return false
      }

      if (externalImportSpecifiers.includes(specifier)) {
        onExternal({
          specifier,
          reason: `declared in "externalImportSpecifiers"`,
        })
        return { id: specifier, external: true }
      }

      if (inlineModuleScripts.hasOwnProperty(specifier)) {
        return specifier
      }

      if (isFileSystemPath(importer)) {
        importer = fileSystemPathToUrl(importer)
      }

      const importUrl = await importResolver.resolveImport(specifier, importer)

      const existingImporter = urlImporterMap[importUrl]
      if (!existingImporter) {
        urlImporterMap[importUrl] = importAssertionInfo
          ? {
              url: importer,
              column: importAssertionInfo.column,
              line: importAssertionInfo.line,
            }
          : {
              url: importer,
              // rollup do not expose a way to know line and column for the static or dynamic import
              // referencing that file
              column: undefined,
              line: undefined,
            }
      }

      // keep external url intact
      const importProjectUrl = asProjectUrl(importUrl)
      if (!importProjectUrl) {
        onExternal({
          specifier,
          reason: `outside project directory`,
        })
        return { id: specifier, external: true }
      }

      if (externalUrlPredicate(asOriginalUrl(importProjectUrl))) {
        onExternal({
          specifier,
          reason: `matches "externalUrlPredicate"`,
        })
        return { id: specifier, external: true }
      }

      // const rollupId = urlToRollupId(importUrl, { projectDirectoryUrl, compileServerOrigin })
      // logger.debug(`${specifier} imported by ${importer} resolved to ${importUrl}`)
      return asRollupUrl(importUrl)
    },

    resolveFileUrl: ({
      // referenceId,
      fileName,
    }) => {
      ressourcesReferencedByJs.push(fileName)

      if (format === "esmodule") {
        if (!node && useImportMapToMaximizeCacheReuse && urlVersioning) {
          return `window.__resolveImportUrl__("./${fileName}", import.meta.url)`
        }
        return `new URL("${fileName}", import.meta.url)`
      }
      if (format === "systemjs") {
        // if (useImportMapToMaximizeCacheReuse && urlVersioning) {
        //   return `new URL(System.resolve("./${fileName}", module.meta.url))`
        // }
        return `new URL(System.resolve("./${fileName}", module.meta.url))`
      }
      if (format === "global") {
        return `new URL("${fileName}", document.currentScript && document.currentScript.src || document.baseURI)`
      }
      if (format === "commonjs") {
        return `new URL("${fileName}", "file:///" + __filename.replace(/\\/g, "/"))`
      }
      return null
    },

    // https://rollupjs.org/guide/en#resolvedynamicimport
    // resolveDynamicImport: (specifier, importer) => {

    // },

    async load(rollupUrl) {
      if (rollupUrl === EMPTY_CHUNK_URL) {
        return ""
      }

      let url = asServerUrl(rollupUrl)

      const loadResult = await buildOperation.withSignal((signal) => {
        return urlLoader.loadUrl(rollupUrl, {
          signal,
          logger,
          ressourceBuilder,
        })
      })

      url = loadResult.url
      const code = loadResult.code
      const map = loadResult.map

      // Jsenv helpers are injected as import statements to provide code like babel helpers
      // For now we just compute the information that the target file is a jsenv helper
      // without doing anything special with "targetIsJsenvHelperFile" information
      const originalUrl = asOriginalUrl(rollupUrl)
      const isJsenvHelperFile = urlIsInsideOf(
        originalUrl,
        jsenvHelpersDirectoryInfo.url,
      )

      const importer = urlImporterMap[url]
      // Inform ressource builder that this js module exists
      // It can only be a js module and happens when:
      // - entry point (html) references js
      // - js is referenced by static or dynamic imports
      // For import assertions, the imported ressource (css,json,...)
      // is arelady converted to a js module
      ressourceBuilder.createReferenceFoundByRollup({
        // we don't want to emit a js chunk for every js file found
        // (However we want if the file is preload/prefetch by something else)
        // so we tell asset builder not to emit a chunk for this js reference
        // otherwise rollup would never concat module together
        referenceShouldNotEmitChunk: jsConcatenation,
        contentTypeExpected: "application/javascript",
        referenceLabel: "static or dynamic import",
        referenceUrl: importer.url,
        referenceColumn: importer.column,
        referenceLine: importer.line,
        ressourceSpecifier: url,

        isJsenvHelperFile,
        contentType: "application/javascript",
        bufferBeforeBuild: Buffer.from(code),
        isJsModule: true,
      })

      return {
        code,
        map,
      }
    },

    async transform(code, id) {
      let map = null
      // we should try/catch here?
      // because this.parse might fail
      const ast = this.parse(code, {
        // used to know node line and column
        locations: true,
      })
      // const moduleInfo = this.getModuleInfo(id)
      const url = asServerUrl(id)

      const mutations = []
      await visitImportReferences({
        ast,
        onReferenceWithImportMetaUrlPattern: async ({ importNode }) => {
          const specifier = importNode.arguments[0].value
          const { line, column } = importNode.loc.start
          const reference = ressourceBuilder.createReferenceFoundInJsModule({
            referenceLabel: "URL + import.meta.url",
            jsUrl: url,
            jsLine: line,
            jsColumn: column,
            ressourceSpecifier: specifier,
          })
          if (!reference) {
            return
          }
          mutations.push((magicString) => {
            magicString.overwrite(
              importNode.start,
              importNode.end,
              referenceToCodeForRollup(reference),
            )
          })
        },
        onReferenceWithImportAssertion: async ({
          importNode,
          typePropertyNode,
          assertions,
        }) => {
          const { source } = importNode
          const importSpecifier = source.value
          const { line, column } = importNode.loc.start

          // "type" is dynamic on dynamic import such as
          // import("./data.json", {
          //   assert: {
          //     type: true ? "json" : "css"
          //    }
          // })
          if (typePropertyNode) {
            const typePropertyValue = typePropertyNode.value
            if (typePropertyValue.type !== "Literal") {
              if (importAssertionSupportedByRuntime) {
                return // keep untouched
              }
              throw new Error(
                createDetailedMessage(
                  `Dynamic "type" not supported for dynamic import assertion`,
                  {
                    "import assertion trace": stringifyUrlTrace(
                      urlLoader.createUrlTrace({ url, line, column }),
                    ),
                  },
                ),
              )
            }
            assertions = {
              type: typePropertyValue.value,
            }
          }

          const { type } = assertions

          // "specifier" is dynamic on dynamic import such as
          // import(true ? "./a.json" : "b.json", {
          //   assert: {
          //     type: "json"
          //    }
          // })
          const importAssertionSupportedByRuntime =
            importAssertionsSupport[type]
          if (source.type !== "Literal") {
            if (importAssertionSupportedByRuntime) {
              return // keep untouched
            }
            throw new Error(
              createDetailedMessage(
                `Dynamic specifier not supported for dynamic import assertion`,
                {
                  "import assertion trace": stringifyUrlTrace(
                    urlLoader.createUrlTrace({ url, line, column }),
                  ),
                },
              ),
            )
          }

          // There is no strategy for css import assertion on Node.js
          // and that's normal
          if (type === "css" && node) {
            throw new Error(
              createDetailedMessage(
                `{ type: "css" } is not supported when "node" is part of "runtimeSupport"`,
                {
                  "import assertion trace": stringifyUrlTrace(
                    urlLoader.createUrlTrace({ url, line, column }),
                  ),
                },
              ),
            )
          }

          const { id, external } = normalizeRollupResolveReturnValue(
            await this.resolve(importSpecifier, url, {
              custom: {
                importAssertionInfo: {
                  line,
                  column,
                  type,
                  supportedByRuntime: importAssertionSupportedByRuntime,
                },
              },
            }),
          )

          const ressourceUrl = asServerUrl(id)
          if (external) {
            if (importAssertionSupportedByRuntime) {
              const reference = ressourceBuilder.createReferenceFoundInJsModule(
                {
                  referenceLabel: "import assertion",
                  isImportAssertion: true,
                  jsUrl: url,
                  jsLine: line,
                  jsColumn: column,
                  ressourceSpecifier: ressourceUrl,
                },
              )
              // reference can be null for cross origin urls
              if (!reference) {
                return
              }
              await reference.ressource.getReadyPromise()
              // markBuildRelativeUrlAsUsedByJs(
              //   reference.ressource.buildRelativeUrl,
              // )
              return
            }

            throw new Error(
              createDetailedMessage(
                `import assertion ressource cannot be external when runtime do not support import assertions`,
                {
                  "import assertion trace": stringifyUrlTrace(
                    urlLoader.createUrlTrace({ url, line, column }),
                  ),
                },
              ),
            )
          }

          // we want to convert the import assertions into a js module
          // to do that we append ?import_type to the url
          // In theory this is not needed anymore:
          // This is already done by the compile server
          const ressourceUrlAsJsModule = setUrlSearchParamsDescriptor(
            ressourceUrl,
            {
              import_type: type,
            },
          )

          mutations.push((magicString) => {
            magicString.overwrite(
              importNode.source.start,
              importNode.source.end,
              `"${ressourceUrlAsJsModule}"`,
            )
            if (typePropertyNode) {
              magicString.remove(typePropertyNode.start, typePropertyNode.end)
            }
          })
        },
      })
      if (mutations.length > 0) {
        const magicString = new MagicString(code)
        mutations.forEach((mutation) => {
          mutation(magicString)
        })
        code = magicString.toString()
        map = magicString.generateMap({ hires: true })
      }

      return { code, map }
    },

    // resolveImportMeta: () => {}
    outputOptions: (outputOptions) => {
      const extension = extname(entryPointMap[Object.keys(entryPointMap)[0]])
      const outputExtension = extension === ".html" ? ".js" : extension

      outputOptions.paths = (id) => {
        const mapping = importPaths[id]
        if (mapping) {
          return mapping
        }
        if (format === "commonjs") {
          if (id.startsWith("node:")) {
            return id.slice("node:".length)
          }
        }
        return id
      }
      outputOptions.entryFileNames = () => {
        if (urlVersionningForEntryPoints) {
          return `[name]-[hash]${outputExtension}`
        }
        return `[name]${outputExtension}`
      }
      outputOptions.chunkFileNames = () => {
        // const originalUrl = asOriginalUrl(chunkInfo.facadeModuleId)
        // const basename = urlToBasename(originalUrl)
        if (useImportMapToMaximizeCacheReuse) {
          return `[name]${outputExtension}`
        }
        return `[name]-[hash]${outputExtension}`
      }

      // rollup does not expects to have http dependency in the mix: fix them
      outputOptions.sourcemapPathTransform = (relativePath, sourcemapPath) => {
        const sourcemapUrl = fileSystemPathToUrl(sourcemapPath)
        const url = relativePathToUrl(relativePath, sourcemapUrl)
        const serverUrl = asServerUrl(url)
        const finalUrl =
          urlFetcher.getUrlBeforeRedirection(serverUrl) || serverUrl
        const projectUrl = asProjectUrl(finalUrl)

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

    async generateBundle(outputOptions, rollupResult) {
      const jsChunks = {}
      // To keep in mind: rollupResult object can be mutated by late asset emission
      // however late chunk (js module) emission is not possible
      // as rollup rightfully prevent late js emission
      Object.keys(rollupResult).forEach((fileName) => {
        const file = rollupResult[fileName]

        // there is 3 types of file: "placeholder", "asset", "chunk"
        if (file.type === "asset") {
          return
        }

        if (file.type === "chunk") {
          const { facadeModuleId } = file
          if (facadeModuleId === EMPTY_CHUNK_URL) {
            return
          }
          const fileCopy = { ...file }
          if (facadeModuleId) {
            fileCopy.url = asServerUrl(facadeModuleId)
          } else {
            const sourcePath = file.map.sources[file.map.sources.length - 1]
            const fileBuildUrl = resolveUrl(file.fileName, buildDirectoryUrl)
            const originalProjectUrl = resolveUrl(sourcePath, fileBuildUrl)
            fileCopy.url = asCompiledServerUrl(originalProjectUrl, {
              projectDirectoryUrl,
              compileServerOrigin,
              compileDirectoryRelativeUrl,
            })
          }
          jsChunks[fileName] = fileCopy
        }
      })

      const jsModuleBuild = {}
      Object.keys(jsChunks).forEach((fileName) => {
        const file = jsChunks[fileName]
        let buildRelativeUrl

        if (file.url in inlineModuleScripts && format === "systemjs") {
          const code = file.code
          const systemRegisterIndex = code.indexOf("System.register([")
          const magicString = new MagicString(code)
          magicString.overwrite(
            systemRegisterIndex,
            systemRegisterIndex + "System.register([".length,
            `System.register("${fileName}", [`,
          )
          file.code = magicString.toString()
        }

        const originalProjectUrl = asOriginalUrl(file.url)
        const originalProjectRelativeUrl = urlToRelativeUrl(
          originalProjectUrl,
          projectDirectoryUrl,
        )
        const jsRessource = ressourceBuilder.findRessource(
          (ressource) => ressource.url === file.url,
        )

        let ressourceName
        if (urlVersioning) {
          ressourceName = fileName
          if (useImportMapToMaximizeCacheReuse) {
            // TOOD: jsRessource might not exists
            // for chunks generated dynamically by rollup
            // for thoose ressource
            // we should create a new type of ressource
            buildRelativeUrl = urlVersioner.computeBuildRelativeUrl(jsRessource)
            buildManifest[ressourceName] = buildRelativeUrl
          } else {
            buildRelativeUrl = fileName
          }
        } else {
          ressourceName = asFileNameWithoutHash(fileName)
          buildRelativeUrl = fileName
        }

        if (jsRessource && jsRessource.isInline) {
          buildInlineFileContents[buildRelativeUrl] = file.code
          if (format === "systemjs") {
            ressourcesReferencedByJs.push(ressourceName)
          }
        } else {
          buildMappings[originalProjectRelativeUrl] = buildRelativeUrl
        }

        jsModuleBuild[buildRelativeUrl] = file
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
      ressourceBuilder.rollupBuildEnd({ jsModuleBuild, buildManifest })
      // wait html files to be emitted
      await ressourceBuilder.getAllEntryPointsEmittedPromise()
      onBundleEnd()

      const assetBuild = {}
      Object.keys(rollupResult).forEach((rollupFileId) => {
        const file = rollupResult[rollupFileId]
        if (file.type !== "asset") {
          return
        }

        const assetRessource = ressourceBuilder.findRessource(
          (ressource) => ressource.relativeUrl === rollupFileId,
        )
        // the asset does not exists in the project it was generated during building
        // happens for sourcemap
        if (!assetRessource) {
          const buildRelativeUrl = rollupFileId
          assetBuild[buildRelativeUrl] = file
          const ressourceName = asFileNameWithoutHash(buildRelativeUrl)
          buildManifest[ressourceName] = buildRelativeUrl
          return
        }

        // ignore potential useless assets which happens when:
        // - sourcemap re-emitted
        // - importmap re-emitted to have buildRelativeUrlMap
        if (assetRessource.shouldBeIgnored) {
          return
        }

        // Ignore file only referenced by import assertions
        // - if file is referenced by import assertion and html or import meta url
        //   then source file is duplicated. If concatenation is disabled
        //   and import assertions are supported, the file is still converted to js module
        const isReferencedOnlyByImportAssertions =
          assetRessource.references.every((reference) => {
            return reference.isImportAssertion
          })
        if (isReferencedOnlyByImportAssertions) {
          return
        }

        const buildRelativeUrl = assetRessource.buildRelativeUrl
        if (assetRessource.isInline) {
          buildInlineFileContents[buildRelativeUrl] = file.source
          return
        }

        const ressourceName = asFileNameWithoutHash(buildRelativeUrl)
        const originalProjectUrl = asOriginalUrl(assetRessource.url)
        const originalProjectRelativeUrl = urlToRelativeUrl(
          originalProjectUrl,
          projectDirectoryUrl,
        )
        // in case sourcemap is mutated, we must not trust rollup but the asset builder source instead
        file.source = assetRessource.bufferAfterBuild
        assetBuild[buildRelativeUrl] = file
        buildMappings[originalProjectRelativeUrl] = buildRelativeUrl
        buildManifest[ressourceName] = buildRelativeUrl
      })

      rollupBuild = {
        ...jsModuleBuild,
        ...assetBuild,
      }
      rollupBuild = injectSourcemapInRollupBuild(rollupBuild, {
        buildDirectoryUrl,
      })

      // update rollupBuild, buildInlineFilesContents, buildManifest and buildMappings
      // in case some ressources where inlined by ressourceBuilder.rollupBuildEnd
      Object.keys(rollupBuild).forEach((buildRelativeUrl) => {
        const rollupFileInfo = rollupBuild[buildRelativeUrl]
        const ressource = ressourceBuilder.findRessource((ressource) => {
          if (ressource.buildRelativeUrl === buildRelativeUrl) {
            return true
          }
          if (ressource.url === rollupFileInfo.url) {
            return true
          }
          return false
        })
        if (ressource && ressource.isInline) {
          const ressourceName =
            ressourceNameFromBuildRelativeUrl(buildRelativeUrl)
          if (ressourceName) {
            delete buildManifest[ressourceName]
          }
          const originalProjectUrl = asOriginalUrl(ressource.url)
          const originalRelativeUrl = urlToRelativeUrl(
            originalProjectUrl,
            projectDirectoryUrl,
          )
          delete buildMappings[originalRelativeUrl]
          buildInlineFileContents[buildRelativeUrl] = rollupFileInfo.code
          delete rollupBuild[buildRelativeUrl]
        }
      })

      await finalizeServiceWorkers({
        serviceWorkers,
        classicServiceWorkers,
        serviceWorkerFinalizer,
        projectDirectoryUrl,
        buildDirectoryUrl,
        rollupBuild,
        buildMappings,
        buildManifest,
        lineBreakNormalization,
        minify,
      })

      rollupBuild = sortObjectByPathnames(rollupBuild)
      buildManifest = sortObjectByPathnames(buildManifest)
      buildMappings = sortObjectByPathnames(buildMappings)
      Object.keys(rollupBuild).forEach((buildRelativeUrl) => {
        const { type, source, code } = rollupBuild[buildRelativeUrl]
        buildFileContents[buildRelativeUrl] = type === "asset" ? source : code
      })
      const buildDuration = Date.now() - buildStartMs
      buildStats = createBuildStats({
        buildFileContents,
        ressourceBuilder,
        buildDuration,
      })

      logger.info(
        formatBuildDoneInfo({
          buildStats,
          buildDirectoryRelativeUrl: urlToRelativeUrl(
            buildDirectoryUrl,
            projectDirectoryUrl,
          ),
        }),
      )
    },
  })

  const fetchImportMapFromUrl = async (importMapUrl, importer) => {
    const importMapResponse = await urlFetcher.fetchUrl(importMapUrl, {
      urlTrace: importer,
      contentTypeExpected: "application/importmap+json",
    })
    const importMap = await importMapResponse.json()
    const importMapNormalized = normalizeImportMap(
      importMap,
      importMapResponse.url,
    )
    return importMapNormalized
  }

  return {
    rollupPlugins,
    getLastErrorMessage: () => lastErrorMessage,
    getResult: async () => {
      return {
        rollupBuild,
        urlResponseBodyMap: urlLoader.getUrlResponseBodyMap(),
        buildMappings,
        buildManifest,
        buildImportMap: await createImportMapForFilesUsedInJs(),
        buildFileContents,
        buildInlineFileContents,
        buildStats,
      }
    },
    asOriginalUrl,
    asProjectUrl,
    rollupGetModuleInfo,
  }
}

const prepareEntryPoints = async (
  entryPointMap,
  {
    logger,
    projectDirectoryUrl,
    buildDirectoryUrl,
    compileServerOrigin,
    urlFetcher,
  },
) => {
  const entryFileRelativeUrls = Object.keys(entryPointMap)
  const entryPointsPrepared = []
  await entryFileRelativeUrls.reduce(async (previous, entryFileRelativeUrl) => {
    await previous

    const entryProjectUrl = resolveUrl(
      entryFileRelativeUrl,
      projectDirectoryUrl,
    )
    const entryBuildUrl = resolveUrl(
      entryPointMap[entryFileRelativeUrl],
      buildDirectoryUrl,
    )

    const entryProjectRelativeUrl = urlToRelativeUrl(
      entryProjectUrl,
      projectDirectoryUrl,
    )
    const entryBuildRelativeUrl = urlToRelativeUrl(
      entryBuildUrl,
      buildDirectoryUrl,
    )

    logger.debug(`${UNICODE.INFO} load entry point ${entryProjectRelativeUrl}`)

    const entryServerUrl = resolveUrl(
      entryProjectRelativeUrl,
      compileServerOrigin,
    )

    const entryResponse = await urlFetcher.fetchUrl(entryServerUrl, {
      urlTrace: `entryPointMap`,
    })
    const entryContentType = entryResponse.headers["content-type"]
    const isHtml = entryContentType === "text/html"

    entryPointsPrepared.push({
      entryContentType:
        entryContentType === "text/javascript"
          ? "application/javascript"
          : entryContentType,
      entryProjectRelativeUrl,
      entryBuildRelativeUrl,
      ...(isHtml
        ? { entryBuffer: Buffer.from(await entryResponse.arrayBuffer()) }
        : {}),
    })
  }, Promise.resolve())

  return entryPointsPrepared
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

const normalizeRollupResolveReturnValue = (resolveReturnValue) => {
  if (resolveReturnValue === null) {
    return { id: null, external: true }
  }
  if (typeof resolveReturnValue === "string") {
    return { id: resolveReturnValue, external: false }
  }

  return resolveReturnValue
}

const asFileNameWithoutHash = (fileName) => {
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

const acceptsJsonContentType = ({ node, format }) => {
  if (!node) {
    return false
  }
  if (format === "commonjs") {
    return true
  }
  if (process.execArgv.includes("--experimental-json-modules")) {
    return true
  }
  return false
}

const finalizeServiceWorkers = async ({
  serviceWorkers,
  classicServiceWorkers,
  serviceWorkerFinalizer,
  buildMappings,
  buildManifest,
  rollupBuild,
  lineBreakNormalization,
}) => {
  const serviceWorkerKeys = Object.keys(serviceWorkers)
  const classicServiceWorkerKeys = Object.keys(classicServiceWorkers)
  const projectRelativeUrls = [
    ...serviceWorkerKeys,
    ...classicServiceWorkerKeys,
  ]

  await Promise.all(
    projectRelativeUrls.map(async (projectRelativeUrl) => {
      const projectUrl = resolveUrl(projectRelativeUrl, "file://")
      projectRelativeUrl = urlToRelativeUrl(projectUrl, "file://")
      const serviceWorkerBuildRelativeUrl = buildMappings[projectRelativeUrl]
      if (!serviceWorkerBuildRelativeUrl) {
        throw new Error(
          `"${projectRelativeUrl}" service worker file missing in the build`,
        )
      }
      const rollupFileInfo = rollupBuild[serviceWorkerBuildRelativeUrl]
      // module service worker
      if (serviceWorkerKeys.includes(projectRelativeUrl)) {
        let code = rollupFileInfo.code
        code = await serviceWorkerFinalizer(code, {
          serviceWorkerBuildRelativeUrl,
          buildManifest,
          rollupBuild,
          lineBreakNormalization,
        })
        rollupFileInfo.code = code
      }
      // "classic" service worker
      else {
        let code = rollupFileInfo.source
        code = await serviceWorkerFinalizer(code, {
          serviceWorkerBuildRelativeUrl,
          buildManifest,
          rollupBuild,
          lineBreakNormalization,
        })
        rollupFileInfo.source = code
      }
    }),
  )
}
