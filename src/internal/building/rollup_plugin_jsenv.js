import path from "node:path"
import MagicString from "magic-string"
import { composeTwoImportMaps, normalizeImportMap } from "@jsenv/importmap"
import { isSpecifierForNodeCoreModule } from "@jsenv/importmap/src/isSpecifierForNodeCoreModule.js"
import { createDetailedMessage, loggerToLogLevel } from "@jsenv/logger"
import {
  fileSystemPathToUrl,
  resolveUrl,
  urlToRelativeUrl,
  resolveDirectoryUrl,
  comparePathnames,
  urlIsInsideOf,
  normalizeStructuredMetaMap,
  urlToMeta,
  urlToBasename,
  urlToFilename,
  readFile,
  urlToFileSystemPath,
} from "@jsenv/filesystem"
import { UNICODE } from "@jsenv/log"

import { require } from "@jsenv/core/src/internal/require.js"
import { convertJsonTextToJavascriptModule } from "@jsenv/core/src/internal/building/json_module.js"
import { convertCssTextToJavascriptModule } from "@jsenv/core/src/internal/building/css_module.js"
import { transformJs } from "@jsenv/core/src/internal/compile_server/js-compilation-service/transformJs.js"
import { createUrlConverter } from "@jsenv/core/src/internal/url_conversion.js"
import { createUrlFetcher } from "@jsenv/core/src/internal/building/url_fetcher.js"
import { createUrlLoader } from "@jsenv/core/src/internal/building/url_loader.js"
import { stringifyUrlTrace } from "@jsenv/core/src/internal/building/url_trace.js"
import { sortObjectByPathnames } from "@jsenv/core/src/internal/building/sortObjectByPathnames.js"
import { jsenvHelpersDirectoryInfo } from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import { createImportResolverForNode } from "@jsenv/core/src/internal/import_resolution/import_resolver_node.js"
import { createImportResolverForImportmap } from "@jsenv/core/src/internal/import_resolution/import_resolver_importmap.js"
import { getDefaultImportmap } from "@jsenv/core/src/internal/import_resolution/importmap_default.js"
import { createJsenvRemoteDirectory } from "@jsenv/core/src/internal/jsenv_remote_directory.js"
import { setUrlSearchParamsDescriptor } from "@jsenv/core/src/internal/url_utils.js"
import { shakeBabelPluginMap } from "@jsenv/core/src/internal/compile_server/jsenv_directory/compile_profile.js"

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
import { createBuildUrlGenerator } from "./build_url_generator.js"
import { visitImportReferences } from "./import_references.js"
import { esToSystem } from "./es_to_system.js"
import { createBuildStats } from "./build_stats.js"

export const createRollupPlugins = async ({
  buildOperation,
  logger,

  projectDirectoryUrl,
  entryPoints,
  buildDirectoryUrl,

  urlMappings,
  importResolutionMethod,
  importMapFileRelativeUrl,
  importDefaultExtension,
  externalImportSpecifiers,
  importPaths,
  preservedUrls,
  serviceWorkerFinalizer,

  format,
  systemJsUrl,
  globals,
  preservedDynamicImports,

  node,
  compileServer,
  compileProfile,
  compileId,

  urlVersioning,
  lineBreakNormalization,
  jsConcatenation,
  cssConcatenation,
  useImportMapToMaximizeCacheReuse,

  minify,
  minifyJsOptions,
  minifyCssOptions,
  minifyHtmlOptions,
}) => {
  const compileServerOrigin = compileServer.origin
  // For now the compilation is forced during build because this plugin
  // was coded assuming build always requires to be compiled.
  // Ideally jsenv should also be able to build a project using source files
  // and in that case compileProfile and compileId are null
  // the babel plugin map is useless (we can just fetch the source file directly)
  const jsenvDirectoryRelativeUrl = compileServer.jsenvDirectoryRelativeUrl
  const compileDirectoryRelativeUrl = `${jsenvDirectoryRelativeUrl}${compileId}/`
  const babelPluginMap = shakeBabelPluginMap({
    babelPluginMap: compileServer.babelPluginMap,
    compileProfile,
  })
  const importAssertionsSupport = {
    json:
      format === "esmodule" &&
      compileProfile &&
      !compileProfile.missingFeatures["import_assertion_type_json"],
    css:
      format === "esmodule" &&
      compileProfile &&
      !compileProfile.missingFeatures["import_assertion_type_css"],
  }

  const jsenvRemoteDirectory = createJsenvRemoteDirectory({
    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,
    preservedUrls,
  })

  const urlImporterMap = {}
  const inlineModuleScripts = {}
  const jsModulesFromEntry = {}
  const buildFileContents = {}
  const buildInlineFileContents = {}
  let buildStats = {}
  const buildStartMs = Date.now()

  const serviceWorkerUrls = []
  const classicServiceWorkerUrls = []

  let lastErrorMessage
  const storeLatestJsenvPluginError = (error) => {
    lastErrorMessage = error.message
  }

  const extension = path.extname(entryPoints[Object.keys(entryPoints)[0]])
  const outputExtension = extension === ".html" ? ".js" : extension

  const entryPointUrls = {}
  Object.keys(entryPoints).forEach((key) => {
    const url = resolveUrl(key, projectDirectoryUrl)
    entryPointUrls[url] = entryPoints[key]
  })

  let ressourceBuilder
  let importResolver
  let rollupEmitFile = () => {}
  let rollupSetAssetSource = () => {}
  let _rollupGetModuleInfo = () => {}
  const rollupGetModuleInfo = (id) => _rollupGetModuleInfo(id)

  const {
    compileServerOriginForRollup,
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

  const buildUrlGenerator = createBuildUrlGenerator({
    entryPointUrls,
    asOriginalUrl,
    lineBreakNormalization,
  })

  const urlFetcher = createUrlFetcher({
    jsenvRemoteDirectory,
    asOriginalUrl,
    asProjectUrl,
    applyUrlMappings,
    urlImporterMap,
    beforeThrowingResponseValidationError: (error) => {
      storeLatestJsenvPluginError(error)
    },
  })

  const urlCustomLoaders = {}
  const urlLoader = createUrlLoader({
    urlCustomLoaders,
    allowJson: acceptsJsonContentType({ node, format }),
    urlImporterMap,

    asProjectUrl,
    asOriginalUrl,

    urlFetcher,
  })

  const urlMetaGetter = createUrlMetaGetter({
    projectDirectoryUrl,
    jsenvRemoteDirectory,
    preservedUrls,
  })

  // Object mapping project relative urls to build relative urls
  let buildMappings = {}
  // Object mapping ressource names to build relative urls
  let ressourceMappings = {}

  const ressourcesReferencedByJs = []
  const createImportMapForFilesUsedInJs = () => {
    const topLevelMappings = {}
    ressourcesReferencedByJs.sort(comparePathnames).forEach((ressourceName) => {
      const buildRelativeUrl = ressourceMappings[ressourceName]
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
          projectDirectoryUrl,
          jsenvRemoteDirectory,
          url: chunk.facadeModuleId
            ? asOriginalUrl(chunk.facadeModuleId)
            : resolveUrl(chunk.fileName, buildDirectoryUrl),
          code,
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
  if (format === "global") {
    const globalsForRollup = {}
    Object.keys(globals).forEach((key) => {
      if (key.startsWith("./")) {
        const keyAsUrl = resolveUrl(key, projectDirectoryUrl)
        const keyAsPath = urlToFileSystemPath(keyAsUrl)
        globalsForRollup[keyAsPath] = globals[key]
      } else {
        globalsForRollup[key] = globals[key]
      }
    })
    const ESIIFE = require("es-iife")
    const globalNameFromChunkInfo = (chunkInfo) => {
      const originalUrl = asOriginalUrl(chunkInfo.facadeModuleId)
      const originalPath = urlToFileSystemPath(originalUrl)
      const nameFromGlobals = globalsForRollup[originalPath]
      return nameFromGlobals || path.parse(chunkInfo.fileName).name
    }
    const structuredMetaMap = normalizeStructuredMetaMap(
      { preserved: preservedDynamicImports },
      projectDirectoryUrl,
    )
    const isPreservedDynamicImport = (url) => {
      const meta = urlToMeta({ url, structuredMetaMap })
      return Boolean(meta.preserved)
    }
    rollupPlugins.push({
      async transform(code, id) {
        const serverUrl = asServerUrl(id)
        const originalUrl = asOriginalUrl(id)
        if (isPreservedDynamicImport(originalUrl)) {
          return null
        }
        const jsRessource = ressourceBuilder.findRessource((ressource) => {
          return ressource.url === serverUrl
        })
        if (!jsRessource || !jsRessource.isEntryPoint) {
          return null
        }
        let map = null
        const ast = this.parse(code, {
          // used to know node line and column
          locations: true,
        })
        let useDynamicImport = false
        const { walk } = await import("estree-walker")
        walk(ast, {
          enter: (node) => {
            if (node.type === "ImportExpression") {
              useDynamicImport = true
            }
          },
        })
        if (!useDynamicImport) {
          return null
        }
        const magicString = new MagicString(code)
        magicString.prepend(
          `import "@jsenv/core/src/internal/runtime_client/s.js";`,
        )
        code = magicString.toString()
        map = magicString.generateMap({ hires: true })
        return { code, map }
      },

      outputOptions: (outputOptions) => {
        outputOptions.globals = globalsForRollup
        outputOptions.format = "esm"
      },
      resolveImportMeta: (property, { chunkId }) => {
        if (property === "url") {
          return `(document.currentScript && document.currentScript.src || new URL("${chunkId}", document.baseURI).href);`
        }
        return undefined
      },
      renderDynamicImport: ({ moduleId }) => {
        const originalUrl = asOriginalUrl(moduleId)
        if (isPreservedDynamicImport(originalUrl)) {
          return null
        }
        return {
          left: "System.import(",
          right: ")",
        }
      },
      async renderChunk(code, chunkInfo) {
        const serverUrl = asServerUrl(chunkInfo.facadeModuleId)
        const jsRessource = ressourceBuilder.findRessource(
          (ressource) => ressource.url === serverUrl,
        )
        if (jsRessource.isEntryPoint) {
          const name = globalNameFromChunkInfo(chunkInfo)
          const out = ESIIFE.transform({
            code,
            parse: this.parse,
            name,
            sourcemap: true,
            resolveGlobal: (specifier) => {
              const url = resolveUrl(specifier, chunkInfo.facadeModuleId)
              const globalName = urlToBasename(url)
              return globalName
            },
            strict: true,
          })
          code = out.code
          const map = out.map
          return {
            code,
            map,
          }
        }
        return esToSystem({
          code,
          url: serverUrl,
          map: chunkInfo.map,
        })
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
          module: format === "esmodule",
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
      logger.info(formatBuildStartLog({ entryPoints }))

      const entryPointsPrepared = await prepareEntryPoints(entryPoints, {
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
              const importmapFileUrl = asProjectUrl(importMapUrl)
              const jsenvImportmap = getDefaultImportmap(importmapFileUrl, {
                projectDirectoryUrl,
                compileDirectoryUrl,
              })
              const htmlImportmap = JSON.parse(importMapInfoFromHtml.text)
              const importmap = composeTwoImportMaps(
                jsenvImportmap,
                htmlImportmap,
              )
              const importmapNormalized = normalizeImportMap(
                importmap,
                importMapUrl,
              )
              return importmapNormalized
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
            const jsenvImportmap = getDefaultImportmap(entryCompileUrl, {
              projectDirectoryUrl,
              compileDirectoryUrl,
            })
            const entryCompileServerUrl = resolveUrl(
              entryProjectRelativeUrl,
              compileDirectoryServerUrl,
            )
            const importmapNormalized = normalizeImportMap(
              jsenvImportmap,
              entryCompileServerUrl,
            )
            return importmapNormalized
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
              jsenvRemoteDirectory,
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
          urlToHumanUrl: (
            url,
            { showCompiledHint = false, preferRelativeUrls = false } = {},
          ) => {
            if (
              !url.startsWith("http:") &&
              !url.startsWith("https:") &&
              !url.startsWith("file:")
            ) {
              return url
            }
            const originalUrl = asOriginalUrl(url)
            const isCompiled = urlIsInsideOf(url, compileServerOrigin)
            const originalRelativeUrl = urlToRelativeUrl(
              originalUrl,
              projectDirectoryUrl,
            )
            if (showCompiledHint && isCompiled) {
              if (preferRelativeUrls) {
                return `${originalRelativeUrl}[compiled]`
              }
              return `${originalUrl}[compiled]`
            }
            if (preferRelativeUrls) {
              return originalRelativeUrl
            }
            return originalUrl
          },
          resolveRessourceUrl: ({
            ressourceSpecifier,
            isJsModule,
            // isRessourceHint,
            ressourceImporter,
          }) => {
            const getRessourceUrl = () => {
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
              // Entry point (likely html, unlikely css) is referecing a ressource
              // In this situation:
              // - when importmap is referenced: parse the original importmap ressource
              // - other ressource: force compilation (because the HTML url is the original url)
              if (
                ressourceImporter.isEntryPoint &&
                !ressourceImporter.isJsModule
              ) {
                if (ressourceSpecifier.endsWith(".importmap")) {
                  const importmapUrl = resolveUrl(
                    ressourceSpecifier,
                    ressourceImporter.url,
                  )
                  return importmapUrl
                }
                const importerCompiled = asCompiledServerUrl(
                  ressourceImporter.url,
                )
                const ressourceCompiledUrl = resolveUrl(
                  ressourceSpecifier,
                  importerCompiled,
                )
                return ressourceCompiledUrl
              }
              const ressourceCompiledUrl = resolveUrl(
                ressourceSpecifier,
                ressourceImporter.url,
              )
              return ressourceCompiledUrl
            }
            const ressourceUrl = getRessourceUrl()
            const resolutionResult = { url: ressourceUrl }
            const ressourceOriginalUrl =
              asOriginalUrl(ressourceUrl) || ressourceUrl

            if (!urlIsInsideOf(ressourceUrl, compileServerOrigin)) {
              resolutionResult.isCrossOrigin = true
            }

            const urlMeta = urlMetaGetter(ressourceOriginalUrl)
            if (urlMeta.preserve) {
              resolutionResult.isExternal = true
            } else if (jsenvRemoteDirectory.isRemoteUrl(ressourceOriginalUrl)) {
              const fileUrl =
                jsenvRemoteDirectory.fileUrlFromRemoteUrl(ressourceOriginalUrl)
              const compiledFileUrl = asCompiledServerUrl(fileUrl)
              resolutionResult.url = compiledFileUrl
            }
            const { searchParams } = new URL(ressourceUrl)
            if (searchParams.has("module")) {
              resolutionResult.isJsModule = true
            } else if (searchParams.has("worker")) {
              resolutionResult.isWorker = true
              resolutionResult.isJsModule = true
            } else if (searchParams.has("service_worker")) {
              resolutionResult.isServiceWorker = true
              resolutionResult.isJsModule = true
              serviceWorkerUrls.push(ressourceOriginalUrl)
            } else if (searchParams.has("worker_type_classic")) {
              resolutionResult.isWorker = true
            } else if (searchParams.has("service_worker_type_classic")) {
              resolutionResult.isServiceWorker = true
              classicServiceWorkerUrls.push(ressourceOriginalUrl)
            }
            return resolutionResult
          },
          onJsModule: ({ ressource, jsModuleUrl, jsModuleIsInline }) => {
            // we want to emit chunk only when ressource is referenced by something else than rollup
            if (
              jsConcatenation &&
              ressource.references.every((ref) => ref.fromRollup)
            ) {
              return null
            }
            if (ressource.isEntryPoint) {
            } else {
              const importerUrl = resolveUrl(
                entryPointsPrepared[0].entryProjectRelativeUrl,
                compileDirectoryServerUrl,
              )
              urlImporterMap[jsModuleUrl] = {
                url: importerUrl,
                line: undefined,
                column: undefined,
              }
              jsModulesFromEntry[asRollupUrl(jsModuleUrl)] = true
              if (jsModuleIsInline) {
                inlineModuleScripts[jsModuleUrl] = ressource
                urlCustomLoaders[jsModuleUrl] = async () => {
                  const url = asOriginalUrl(jsModuleUrl) // transformJs expect a file:// url
                  let code = String(ressource.bufferBeforeBuild)
                  const transformResult = await transformJs({
                    projectDirectoryUrl,
                    jsenvRemoteDirectory,
                    url,
                    babelPluginMap,
                    // moduleOutFormat: format // we are compiling for rollup output must be "esmodule"
                    // we compile for rollup, let top level await untouched
                    // it will be converted, if needed, during "renderChunk" hook
                    topLevelAwait: "ignore",
                    // if we put babel helpers, rollup might try to share them and a file
                    // might try to import from an inline script resulting in 404.
                    babelHelpersInjectionAsImport: false,
                    code,
                  })
                  return {
                    code: transformResult.code,
                    map: transformResult.map,
                  }
                }
              }
            }
            const fileName = ressource.buildRelativeUrlWithoutHash
            const name = urlToBasename(resolveUrl(fileName, "file://"))
            const rollupReferenceId = emitChunk({
              id: jsModuleUrl,
              name,
              ...(useImportMapToMaximizeCacheReuse && !ressource.isInline
                ? { fileName }
                : {}),
            })
            return {
              rollupReferenceId,
              fileName:
                useImportMapToMaximizeCacheReuse && !ressource.isInline
                  ? fileName
                  : name,
            }
          },
          onAsset: ({ ressource }) => {
            const fileName = ressource.buildRelativeUrlWithoutHash
            const rollupReferenceId = emitAsset({
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
          buildUrlGenerator,
        },
      )

      await Promise.all(
        entryPointsPrepared.map(
          async ({
            entryContentType,
            entryProjectRelativeUrl,
            entryBuffer,
          }) => {
            if (entryContentType === "application/javascript") {
              await ressourceBuilder.createReferenceForEntryPoint({
                entryContentType,
                entryUrl: resolveUrl(
                  entryProjectRelativeUrl,
                  compileDirectoryServerUrl,
                ),
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

    async resolveId(specifier, importer, { custom = {} } = {}) {
      if (specifier === EMPTY_CHUNK_URL) {
        return specifier
      }

      let importerUrl
      if (importer === undefined) {
        if (specifier.endsWith(".html")) {
          importerUrl = compileServerOrigin
        } else {
          importerUrl = compileDirectoryServerUrl
        }
      } else {
        importerUrl = asServerUrl(importer)
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
        return asRollupUrl(specifier)
      }

      const specifierUrl = await importResolver.resolveImport(
        specifier,
        importerUrl,
      )
      const existingImporter = urlImporterMap[specifierUrl]
      if (!existingImporter) {
        urlImporterMap[specifierUrl] = importAssertionInfo
          ? {
              url: importerUrl,
              column: importAssertionInfo.column,
              line: importAssertionInfo.line,
            }
          : {
              url: importerUrl,
              // rollup do not expose a way to know line and column for the static or dynamic import
              // referencing that file
              column: undefined,
              line: undefined,
            }
      }
      // keep external url intact
      const specifierProjectUrl = asProjectUrl(specifierUrl)
      if (!specifierProjectUrl) {
        onExternal({
          specifier,
          reason: `outside project directory`,
        })
        return { id: specifier, external: true }
      }
      const specifierOriginalUrl = asOriginalUrl(specifierProjectUrl)
      const urlMeta = urlMetaGetter(specifierOriginalUrl)
      if (urlMeta.preserve) {
        if (urlMeta.remote) {
          specifier =
            jsenvRemoteDirectory.remoteUrlFromFileUrl(specifierOriginalUrl)
        }
        onExternal({
          specifier,
          reason: `matches "preservedUrls"`,
        })
        return { id: specifier, external: true }
      }
      // const rollupId = urlToRollupId(importUrl, { projectDirectoryUrl, compileServerOrigin })
      // logger.debug(`${specifier} imported by ${importer} resolved to ${importUrl}`)
      const specifierRollupUrl = asRollupUrl(specifierUrl)
      return specifierRollupUrl
    },

    resolveFileUrl: ({ referenceId, fileName }) => {
      ressourcesReferencedByJs.push(fileName)
      const getAssetRelativeUrl = () => {
        const ressource = ressourceBuilder.findRessource((ressource) => {
          return ressource.rollupReferenceId === referenceId
        })
        ressource.buildRelativeUrlWithoutHash = fileName
        if (ressource.isJsModule) {
          return fileName
        }
        const buildRelativeUrl = ressource.buildRelativeUrl
        return buildRelativeUrl
      }
      if (format === "esmodule") {
        if (!node && useImportMapToMaximizeCacheReuse && urlVersioning) {
          return `window.__resolveImportUrl__("./${fileName}", import.meta.url)`
        }
        return `new URL("${getAssetRelativeUrl()}", import.meta.url)`
      }
      if (format === "systemjs") {
        return `new URL(System.resolve("./${fileName}", module.meta.url))`
      }
      if (format === "global") {
        return `new URL("${getAssetRelativeUrl()}", document.currentScript && document.currentScript.src || document.baseURI)`
      }
      if (format === "commonjs") {
        return `new URL("${getAssetRelativeUrl()}", "file:///" + __filename.replace(/\\/g, "/"))`
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
      // Jsenv helpers are injected as import statements to provide code like babel helpers
      // For now we just compute the information that the target file is a jsenv helper
      // without doing anything special with "targetIsJsenvHelperFile" information
      const projectUrl = asProjectUrl(rollupUrl)
      const originalUrl = asOriginalUrl(rollupUrl)
      const isJsenvHelperFile = urlIsInsideOf(
        originalUrl,
        jsenvHelpersDirectoryInfo.url,
      )
      // const isEntryPoint = entryPointUrls[originalUrl]
      const loadResult = await buildOperation.withSignal((signal) => {
        let urlToLoad
        const jsModuleRessource = ressourceBuilder.findRessource(
          (ressource) => ressource.url === url,
        )
        if (
          jsModuleRessource &&
          jsModuleRessource.firstStrongReference &&
          jsModuleRessource.firstStrongReference.integrity
        ) {
          urlToLoad = setUrlSearchParamsDescriptor(url, {
            integrity: jsModuleRessource.firstStrongReference.integrity,
          })
          urlImporterMap[urlToLoad] = urlImporterMap[url]
        } else {
          urlToLoad = url
        }
        return urlLoader.loadUrl(urlToLoad, {
          signal,
          logger,
        })
      })
      // if (loadResult.url) url = loadResult.url
      const code = loadResult.code
      const map = loadResult.map
      if (jsenvRemoteDirectory.isFileUrlForRemoteUrl(originalUrl)) {
        map.sources.forEach((source, index) => {
          if (jsenvRemoteDirectory.isRemoteUrl(source)) {
            const sourceFileUrl =
              jsenvRemoteDirectory.fileUrlFromRemoteUrl(source)
            const sourceRelativeUrl = urlToRelativeUrl(
              sourceFileUrl,
              projectUrl,
            )
            map.sources[index] = sourceRelativeUrl
          }
        })
      }
      const importer = urlImporterMap[url]
      // Inform ressource builder that this js module exists
      // It can only be a js module and happens when:
      // - entry point (html) references js
      // - js is referenced by static or dynamic imports
      // For import assertions, the imported ressource (css,json,...)
      // is already converted to a js module
      ressourceBuilder.createReferenceFoundByRollup({
        contentTypeExpected: "application/javascript",
        referenceLabel: "static or dynamic import",
        referenceUrl: importer.url,
        referenceColumn: importer.column,
        referenceLine: importer.line,
        ressourceSpecifier: url,
        isJsenvHelperFile,
        contentType: "application/javascript",
        isJsModule: true,
        bufferBeforeBuild: Buffer.from(code),
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
          const { id } = normalizeRollupResolveReturnValue(
            await this.resolve(specifier, url),
          )
          const ressourceUrl = asServerUrl(id)
          const reference = ressourceBuilder.createReferenceFoundInJsModule({
            referenceLabel: "URL + import.meta.url",
            jsUrl: url,
            jsLine: line,
            jsColumn: column,
            ressourceSpecifier: ressourceUrl,
          })
          if (!reference) {
            return
          }
          if (!reference.ressource.isJsModule) {
            // so that ressource.buildRelativeUrl is known during "resolveFileUrl" hook`
            await reference.ressource.getReadyPromise()
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
          // remove import
          let ressourceUrl = asServerUrl(id)
          // lod the asset without ?import_type in it
          ressourceUrl = ressourceUrl.replace(`?import_type=${type}`, "")
          const fileReference = ressourceBuilder.createReferenceFoundInJsModule(
            {
              referenceLabel: `${type} import assertion`,
              // If all references to a ressource are only import assertions
              // the file referenced do not need to be written on filesystem
              // as it was converted to a js file
              // We pass "isImportAssertion: true" for this purpose
              isImportAssertion: true,
              jsUrl: url,
              jsLine: line,
              jsColumn: column,
              ressourceSpecifier: ressourceUrl,
              contentTypeExpected:
                type === "css" ? "text/css" : "application/json",
            },
          )
          // reference can be null for cross origin urls
          if (!fileReference) {
            return
          }
          if (external && !importAssertionSupportedByRuntime) {
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

          // await fileReference.ressource.getReadyPromise()
          // once the file is ready, we know its buildRelativeUrl
          // we can update either to the fileName or buildRelativeUrl
          // should be use the rollup reference id?
          const ressourceUrlAsJsModule = resolveUrl(
            `${urlToBasename(
              ressourceUrl,
            )}${outputExtension}?import_type=${type}`,
            ressourceUrl,
          )
          const jsUrl = url
          urlCustomLoaders[ressourceUrlAsJsModule] = async () => {
            let code
            let map

            if (type === "json") {
              await fileReference.ressource.getReadyPromise()
              code = String(fileReference.ressource.bufferAfterBuild)
              const jsModuleConversionResult =
                await convertJsonTextToJavascriptModule({
                  code,
                  map,
                })
              code = jsModuleConversionResult.code
              map = jsModuleConversionResult.map
            } else if (type === "css") {
              await fileReference.ressource.getReadyPromise()
              const cssBuildUrl = resolveUrl(
                fileReference.ressource.buildRelativeUrl,
                buildDirectoryUrl,
              )
              const jsBuildUrl = resolveUrl(
                urlToFilename(jsUrl),
                buildDirectoryUrl,
              )
              code = String(fileReference.ressource.bufferAfterBuild)
              const sourcemapReference =
                fileReference.ressource.dependencies.find((dependency) => {
                  return dependency.ressource.isSourcemap
                })
              if (sourcemapReference) {
                // because css is ready, it's sourcemap is also ready
                // we can read directly sourcemapReference.ressource.bufferAfterBuild
                map = JSON.parse(sourcemapReference.ressource.bufferAfterBuild)
              }
              const jsModuleConversionResult =
                await convertCssTextToJavascriptModule({
                  cssUrl: cssBuildUrl,
                  jsUrl: jsBuildUrl,
                  code,
                  map,
                })
              code = jsModuleConversionResult.code
              map = jsModuleConversionResult.map
            }

            return { code, map }
          }

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
      // outputOptions.assetFileNames = () => {
      //   return `assets/[name]_[hash][extname]`
      // }
      outputOptions.entryFileNames = () => {
        if (useImportMapToMaximizeCacheReuse) {
          return `[name]${outputExtension}`
        }
        return entryPoints
      }
      outputOptions.chunkFileNames = (chunkInfo) => {
        // maybe we should find ressource from ressource builder and return
        // the buildRelativeUrlPattern?

        // const originalUrl = asOriginalUrl(chunkInfo.facadeModuleId)
        // const basename = urlToBasename(originalUrl)
        if (useImportMapToMaximizeCacheReuse) {
          return `[name]${outputExtension}`
        }
        if (chunkInfo.isEntry) {
          const originalUrl = asOriginalUrl(chunkInfo.facadeModuleId)
          const entryPointPattern = entryPointUrls[originalUrl]
          if (entryPointPattern) {
            return entryPointPattern
          }
        }
        return urlVersioning
          ? `[name]_[hash]${outputExtension}`
          : `[name]${outputExtension}`
      }

      const getStringAfter = (string, substring) => {
        const index = string.indexOf(substring)
        if (index === -1) return ""
        return string.slice(index + substring.length)
      }

      // rollup does not expects to have http dependency in the mix: fix them
      outputOptions.sourcemapPathTransform = (relativePath, sourcemapPath) => {
        const sourcemapUrl = fileSystemPathToUrl(sourcemapPath)
        // here relativePath contains a protocol
        // because rollup don't work with url but with filesystem paths
        // let fix it below
        const sourceRollupUrlRaw = resolveUrl(relativePath, sourcemapUrl)
        const afterOrigin =
          getStringAfter(sourceRollupUrlRaw, "http:/jsenv.com") ||
          getStringAfter(sourceRollupUrlRaw, "https:/jsenv.com")
        const sourceRollupUrl = afterOrigin
          ? `${compileServerOriginForRollup}${afterOrigin}`
          : sourceRollupUrlRaw

        const sourceServerUrl = asServerUrl(sourceRollupUrl)
        const sourceUrl =
          urlFetcher.getUrlBeforeRedirection(sourceServerUrl) || sourceServerUrl
        const sourceProjectUrl = asProjectUrl(sourceUrl)

        if (jsenvRemoteDirectory.isFileUrlForRemoteUrl(sourceProjectUrl)) {
          const remoteUrl =
            jsenvRemoteDirectory.remoteUrlFromFileUrl(sourceProjectUrl)
          return remoteUrl
        }
        if (sourceProjectUrl) {
          relativePath = urlToRelativeUrl(sourceProjectUrl, sourcemapUrl)
          return relativePath
        }
        return sourceUrl
      }
      return outputOptions
    },

    async renderChunk(code, chunk) {
      const { facadeModuleId } = chunk
      if (!facadeModuleId) {
        // happens for inline module scripts for instance
        return null
      }
      const url = asOriginalUrl(facadeModuleId)
      const { searchParams } = new URL(url)
      if (
        format === "systemjs" &&
        (searchParams.has("worker") || searchParams.has("service_worker"))
      ) {
        const magicString = new MagicString(code)
        const systemjsCode = await readFile(
          new URL("../runtime_client/s.js", import.meta.url),
        )
        magicString.prepend(systemjsCode)
        code = magicString.toString()
        const map = magicString.generateMap({ hires: true })
        return {
          code,
          map,
        }
      }
      return null
    },

    async generateBundle(outputOptions, rollupResult) {
      // it's important to do this to emit late asset
      rollupEmitFile = (...args) => this.emitFile(...args)
      rollupSetAssetSource = (...args) => this.setAssetSource(...args)
      // To keep in mind: rollupResult object can be mutated by late asset emission
      // however late chunk (js module) emission is not possible
      // as rollup rightfully prevent late js emission
      Object.keys(rollupResult).forEach((fileName) => {
        const rollupFileInfo = rollupResult[fileName]
        // there is 3 types of file: "placeholder", "asset", "chunk"
        if (rollupFileInfo.type === "chunk") {
          const { facadeModuleId } = rollupFileInfo
          if (facadeModuleId === EMPTY_CHUNK_URL) {
            delete rollupResult[fileName]
            return
          }
          if (facadeModuleId) {
            rollupFileInfo.url = asServerUrl(facadeModuleId)
          } else {
            const sourcePath =
              rollupFileInfo.map.sources[rollupFileInfo.map.sources.length - 1]
            const fileBuildUrl = resolveUrl(fileName, buildDirectoryUrl)
            const originalProjectUrl = resolveUrl(sourcePath, fileBuildUrl)
            rollupFileInfo.url = asCompiledServerUrl(originalProjectUrl, {
              projectDirectoryUrl,
              compileServerOrigin,
              compileDirectoryRelativeUrl,
            })
          }

          if (
            rollupFileInfo.url in inlineModuleScripts &&
            format === "systemjs"
          ) {
            const code = rollupFileInfo.code
            const systemRegisterIndex = code.indexOf("System.register([")
            const magicString = new MagicString(code)
            magicString.overwrite(
              systemRegisterIndex,
              systemRegisterIndex + "System.register([".length,
              `System.register("${fileName}", [`,
            )
            rollupFileInfo.code = magicString.toString()
          }

          const jsRessource = ressourceBuilder.findRessource((ressource) => {
            return ressource.url === rollupFileInfo.url
          })
          if (
            isReferencedByJs({
              rollupFileInfo,
              jsConcatenation,
              jsRessource,
            })
          ) {
            ressourcesReferencedByJs.push(fileName)
          }
        }
      })

      // malheureusement rollup ne permet pas de savoir lorsqu'un chunk
      // a fini d'etre résolu (parsing des imports statiques et dynamiques recursivement)
      // donc lorsque le build se termine on va indiquer
      // aux assets faisant référence a ces chunk js qu'ils sont terminés
      // et donc les assets peuvent connaitre le nom du chunk
      // et mettre a jour leur dépendance vers ce fichier js
      const { jsRessources } = ressourceBuilder.rollupBuildEnd({
        rollupResult,
        useImportMapToMaximizeCacheReuse,
      })
      Object.keys(jsRessources).forEach((ressourceUrl) => {
        const jsRessource = jsRessources[ressourceUrl]
        if (jsRessource.isInline) {
          buildInlineFileContents[jsRessource.buildRelativeUrl] =
            jsRessource.bufferAfterBuild
          // if (format === "systemjs") {
          //   ressourcesReferencedByJs.push(jsRessource.fileName)
          // }
        } else {
          const originalProjectUrl = asOriginalUrl(ressourceUrl)
          if (jsenvRemoteDirectory.isFileUrlForRemoteUrl(originalProjectUrl)) {
            const remoteUrl =
              jsenvRemoteDirectory.remoteUrlFromFileUrl(originalProjectUrl)
            buildMappings[remoteUrl] = jsRessource.buildRelativeUrl
          } else {
            const originalProjectRelativeUrl = urlToRelativeUrl(
              originalProjectUrl,
              projectDirectoryUrl,
            )
            buildMappings[originalProjectRelativeUrl] =
              jsRessource.buildRelativeUrl
          }
        }
        ressourceMappings[jsRessource.buildRelativeUrlWithoutHash] =
          jsRessource.buildRelativeUrl
      })
      // wait for asset build relative urls
      // to ensure the importmap will contain remappings for them
      // (not sure this is required anymore)
      await Promise.all(
        ressourcesReferencedByJs.map(async (ressourceFileName) => {
          const ressource = ressourceBuilder.findRessource((ressource) => {
            return ressource.buildRelativeUrlWithoutHash === ressourceFileName
          })
          if (ressource && !ressource.isJsModule) {
            await ressource.getReadyPromise()
            ressourceMappings[ressource.buildRelativeUrlWithoutHash] =
              ressource.buildRelativeUrl
          }
        }),
      )
      // wait html files to be emitted
      await ressourceBuilder.getAllEntryPointsEmittedPromise()
      onBundleEnd()

      const jsModuleBuild = {}
      const assetBuild = {}
      Object.keys(rollupResult).forEach((fileName) => {
        const rollupFileInfo = rollupResult[fileName]

        if (rollupFileInfo.type === "chunk") {
          const jsRessource = ressourceBuilder.findRessource((ressource) => {
            return ressource.url === rollupFileInfo.url
          })
          jsModuleBuild[jsRessource.buildRelativeUrl] = rollupFileInfo
          return
        }

        if (rollupFileInfo.type === "asset") {
          const assetRessource = ressourceBuilder.findRessource(
            (ressource) =>
              // happens for import.meta.url pattern
              ressource.buildRelativeUrlWithoutHash === fileName ||
              // happens for sourcemap
              ressource.relativeUrl === fileName,
          )
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
            buildInlineFileContents[buildRelativeUrl] = rollupFileInfo.source
            return
          }
          // in case sourcemap is mutated, we must not trust rollup but the asset builder source instead
          rollupFileInfo.source = assetRessource.bufferAfterBuild
          assetBuild[buildRelativeUrl] = rollupFileInfo
          ressourceMappings[assetRessource.buildRelativeUrlWithoutHash] =
            buildRelativeUrl
          if (assetRessource.bufferBeforeBuild) {
            const originalProjectUrl = asOriginalUrl(assetRessource.url)
            const originalProjectRelativeUrl = urlToRelativeUrl(
              originalProjectUrl,
              projectDirectoryUrl,
            )
            buildMappings[originalProjectRelativeUrl] = buildRelativeUrl
          }
          return
        }
      })
      rollupBuild = {
        ...jsModuleBuild,
        ...assetBuild,
      }
      rollupBuild = sortObjectByPathnames(rollupBuild)
      // fill "buildFileContents", "buildInlineFilesContents"
      // and update "buildMappings"
      // in case some ressource where inlined by ressourceBuilder.rollupBuildEnd
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
        if (ressource.isInline) {
          if (ressource.isJsModule) {
            delete jsModuleBuild[buildRelativeUrl]
          } else {
            delete assetBuild[buildRelativeUrl]
          }
          const originalProjectUrl = asOriginalUrl(ressource.url)
          const originalRelativeUrl = urlToRelativeUrl(
            originalProjectUrl,
            projectDirectoryUrl,
          )
          delete buildMappings[originalRelativeUrl]
          buildInlineFileContents[ressource.buildRelativeUrl] =
            ressource.bufferAfterBuild
        } else {
          buildFileContents[ressource.buildRelativeUrl] =
            ressource.bufferAfterBuild
        }
      })

      ressourceMappings = sortObjectByPathnames(ressourceMappings)
      buildMappings = sortObjectByPathnames(buildMappings)
      await visitServiceWorkers({
        projectDirectoryUrl,
        serviceWorkerFinalizer,
        serviceWorkerUrls,
        classicServiceWorkerUrls,
        buildMappings,
        ressourceMappings,
        buildFileContents,
        lineBreakNormalization,
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
        ressourceMappings,
        // Object mapping build relative urls without hash to build relative urls
        buildManifest: createBuildManifest({
          buildFileContents,
        }),
        buildImportMap: createImportMapForFilesUsedInJs(),
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

const createBuildManifest = ({ buildFileContents }) => {
  const buildManifest = {}
  Object.keys(buildFileContents).forEach((buildRelativeUrl) => {
    const relativeUrlWithoutHash = asFileNameWithoutHash(buildRelativeUrl)
    buildManifest[relativeUrlWithoutHash] = buildRelativeUrl
  })
  return buildManifest
}

const asFileNameWithoutHash = (fileName) => {
  return fileName.replace(/_[a-z0-9]{8,}(\..*?)?$/, (_, afterHash = "") => {
    return afterHash
  })
}

const prepareEntryPoints = async (
  entryPoints,
  {
    logger,
    projectDirectoryUrl,
    buildDirectoryUrl,
    compileServerOrigin,
    urlFetcher,
  },
) => {
  const entryFileRelativeUrls = Object.keys(entryPoints)
  const entryPointsPrepared = []
  await entryFileRelativeUrls.reduce(async (previous, entryFileRelativeUrl) => {
    await previous

    const entryProjectUrl = resolveUrl(
      entryFileRelativeUrl,
      projectDirectoryUrl,
    )
    const entryBuildUrl = resolveUrl(
      entryPoints[entryFileRelativeUrl],
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
      urlTrace: `entryPoints`,
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

const normalizeRollupResolveReturnValue = (resolveReturnValue) => {
  if (resolveReturnValue === null) {
    return { id: null, external: true }
  }
  if (typeof resolveReturnValue === "string") {
    return { id: resolveReturnValue, external: false }
  }

  return resolveReturnValue
}

const createUrlMetaGetter = ({
  projectDirectoryUrl,
  jsenvRemoteDirectory,
  preservedUrls,
}) => {
  const preservedFileUrls = {}
  const remoteFileUrls = {}
  Object.keys(preservedUrls).forEach((pattern) => {
    if (jsenvRemoteDirectory.isRemoteUrl(pattern)) {
      const fileUrlPattern = jsenvRemoteDirectory.fileUrlFromRemoteUrl(pattern)
      preservedFileUrls[fileUrlPattern] = preservedUrls[pattern]
      remoteFileUrls[fileUrlPattern] = true
    }
  })
  const structuredMetaMap = normalizeStructuredMetaMap(
    {
      preserve: {
        ...preservedUrls,
        ...preservedFileUrls,
      },
      remote: remoteFileUrls,
    },
    projectDirectoryUrl,
  )
  return (url) => {
    const meta = urlToMeta({
      url,
      structuredMetaMap,
    })
    return meta
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

const isReferencedByJs = ({ rollupFileInfo, jsConcatenation, jsRessource }) => {
  if (rollupFileInfo.isDynamicEntry) {
    return true
  }
  if (!jsConcatenation && rollupFileInfo.isEntry) {
    return true
  }
  if (
    jsRessource &&
    jsRessource.references.some((ref) => ref.isRessourceHint)
  ) {
    return true
  }
  return false
}

const visitServiceWorkers = async ({
  projectDirectoryUrl,
  serviceWorkerUrls,
  classicServiceWorkerUrls,
  serviceWorkerFinalizer,
  buildMappings,
  buildFileContents,
  lineBreakNormalization,
}) => {
  const allServiceWorkerUrls = [
    ...serviceWorkerUrls,
    ...classicServiceWorkerUrls,
  ]
  await Promise.all(
    allServiceWorkerUrls.map(async (serviceWorkerUrl) => {
      const serviceWorkerRelativeUrl = urlToRelativeUrl(
        serviceWorkerUrl,
        projectDirectoryUrl,
      )
      const serviceWorkerBuildRelativeUrl =
        buildMappings[serviceWorkerRelativeUrl]
      if (!serviceWorkerBuildRelativeUrl) {
        throw new Error(
          `"${serviceWorkerRelativeUrl}" service worker file missing in the build`,
        )
      }
      if (serviceWorkerFinalizer) {
        let code = buildFileContents[serviceWorkerBuildRelativeUrl]
        code = await serviceWorkerFinalizer(code, {
          serviceWorkerBuildRelativeUrl,
          buildFileContents,
          lineBreakNormalization,
        })
        buildFileContents[serviceWorkerBuildRelativeUrl] = code
      }
    }),
  )
}
