/*
 * Build is split in 3 steps:
 * 1. craft
 * 2. shape
 * 3. refine
 *
 * craft: prepare all the materials
 *  - resolve, fetch and transform all source files into "rawGraph"
 * shape: this step can drastically change url content and their relationships
 *  - bundling
 *  - optimizations (minification)
 * refine: perform minor changes on the url contents
 *  - cleaning html
 *  - url versioning
 *  - ressource hints
 *  - injecting urls into service workers
 */

import {
  injectQueryParams,
  setUrlFilename,
  normalizeUrl,
  asUrlWithoutSearch,
  ensurePathnameTrailingSlash,
  urlIsInsideOf,
  urlToBasename,
  urlToExtension,
  urlToRelativeUrl,
} from "@jsenv/urls"
import {
  validateDirectoryUrl,
  ensureEmptyDirectory,
  writeFileSync,
  registerDirectoryLifecycle,
  comparePathnames,
} from "@jsenv/filesystem"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import {
  createLogger,
  createTaskLog,
  ANSI,
  createDetailedMessage,
} from "@jsenv/log"
import { createMagicSource, generateSourcemapFileUrl } from "@jsenv/sourcemap"
import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlNodes,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  removeHtmlNode,
  createHtmlNode,
  insertHtmlNodeAfter,
  findHtmlNode,
} from "@jsenv/ast"

import { createUrlGraph } from "../kitchen/url_graph.js"
import { createKitchen } from "../kitchen/kitchen.js"
import { RUNTIME_COMPAT } from "../kitchen/compat/runtime_compat.js"
import { createUrlGraphLoader } from "../kitchen/url_graph/url_graph_loader.js"
import { createUrlGraphSummary } from "../kitchen/url_graph/url_graph_report.js"
import {
  isWebWorkerEntryPointReference,
  isWebWorkerUrlInfo,
} from "../kitchen/web_workers.js"
import { jsenvPluginUrlAnalysis } from "../plugins/url_analysis/jsenv_plugin_url_analysis.js"
import { jsenvPluginInline } from "../plugins/inline/jsenv_plugin_inline.js"
import { jsenvPluginAsJsClassic } from "../plugins/transpilation/as_js_classic/jsenv_plugin_as_js_classic.js"
import { getCorePlugins } from "../plugins/plugins.js"
import { jsenvPluginLineBreakNormalization } from "./jsenv_plugin_line_break_normalization.js"

import { GRAPH } from "./graph_utils.js"
import { createBuildUrlsGenerator } from "./build_urls_generator.js"
import {
  injectVersionMappingsAsGlobal,
  injectVersionMappingsAsImportmap,
} from "./version_mappings_injection.js"
import { createVersionGenerator } from "./version_generator.js"

// default runtimeCompat corresponds to
// "we can keep <script type="module"> intact":
// so script_type_module + dynamic_import + import_meta
export const defaultRuntimeCompat = {
  // android: "8",
  chrome: "64",
  edge: "79",
  firefox: "67",
  ios: "12",
  opera: "51",
  safari: "11.3",
  samsung: "9.2",
}

/**
 * Generate an optimized version of source files into a directory
 * @param {Object} buildParameters
 * @param {string|url} buildParameters.rootDirectoryUrl
 *        Directory containing source files
 * @param {string|url} buildParameters.buildDirectoryUrl
 *        Directory where optimized files will be written
 * @param {object} buildParameters.entryPoints
 *        Describe entry point paths and control their names in the build directory
 * @param {object} buildParameters.runtimeCompat
 *        Code generated will be compatible with these runtimes
 * @param {string} [buildParameters.assetsDirectory=""]
 *        Directory where asset files will be written
 * @param {string|url} [buildParameters.base=""]
 *        Urls in build file contents will be prefixed with this string
 * @param {boolean} [buildParameters.versioning=true]
 *        Controls if url in build file contents are versioned
 * @param {('search_param'|'filename')} [buildParameters.versioningMethod="search_param"]
 *        Controls how url are versioned
 * @param {boolean|string} [buildParameters.sourcemaps=false]
 *        Generate sourcemaps in the build directory
 * @return {Object} buildReturnValue
 * @return {Object} buildReturnValue.buildFileContents
 *        Contains all build file paths relative to the build directory and their content
 * @return {Object} buildReturnValue.buildInlineContents
 *        Contains content that is inline into build files
 * @return {Object} buildReturnValue.buildManifest
 *        Map build file paths without versioning to versioned file paths
 */
export const build = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  rootDirectoryUrl,
  buildDirectoryUrl,
  assetsDirectory = "",
  entryPoints = {},

  runtimeCompat = defaultRuntimeCompat,
  base = runtimeCompat.node ? "./" : "/",
  plugins = [],
  sourcemaps = false,
  sourcemapsSourcesContent,
  urlAnalysis = {},
  urlResolution,
  fileSystemMagicRedirection,
  directoryReferenceAllowed,
  scenarioPlaceholders,
  transpilation = {},
  versioning = !runtimeCompat.node,
  versioningMethod = "search_param", // "filename", "search_param"
  versioningViaImportmap = true,
  lineBreakNormalization = process.platform === "win32",

  clientFiles = {
    "./src/": true,
  },
  cooldownBetweenFileEvents,
  watch = false,

  directoryToClean,
  writeOnFileSystem = true,
  writeGeneratedFiles = false,
  assetManifest = versioningMethod === "filename",
  assetManifestFileRelativeUrl = "asset-manifest.json",
  ...rest
}) => {
  // param validation
  {
    const unexpectedParamNames = Object.keys(rest)
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      )
    }
    const rootDirectoryUrlValidation = validateDirectoryUrl(rootDirectoryUrl)
    if (!rootDirectoryUrlValidation.valid) {
      throw new TypeError(
        `rootDirectoryUrl ${rootDirectoryUrlValidation.message}, got ${rootDirectoryUrl}`,
      )
    }
    rootDirectoryUrl = rootDirectoryUrlValidation.value
    const buildDirectoryUrlValidation = validateDirectoryUrl(buildDirectoryUrl)
    if (!buildDirectoryUrlValidation.valid) {
      throw new TypeError(
        `buildDirectoryUrl ${buildDirectoryUrlValidation.message}, got ${buildDirectoryUrlValidation}`,
      )
    }
    buildDirectoryUrl = buildDirectoryUrlValidation.value
  }

  const operation = Abort.startOperation()
  operation.addAbortSignal(signal)
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      )
    })
  }

  assertEntryPoints({ entryPoints })
  if (!["filename", "search_param"].includes(versioningMethod)) {
    throw new Error(
      `Unexpected "versioningMethod": must be "filename", "search_param"; got ${versioning}`,
    )
  }
  if (assetsDirectory && assetsDirectory[assetsDirectory.length - 1] !== "/") {
    assetsDirectory = `${assetsDirectory}/`
  }
  if (directoryToClean === undefined) {
    if (assetsDirectory === undefined) {
      directoryToClean = buildDirectoryUrl
    } else {
      directoryToClean = new URL(assetsDirectory, buildDirectoryUrl).href
    }
  }
  const asFormattedBuildUrl = (generatedUrl, reference) => {
    if (base === "./") {
      const urlRelativeToParent = urlToRelativeUrl(
        generatedUrl,
        reference.parentUrl === rootDirectoryUrl
          ? buildDirectoryUrl
          : reference.parentUrl,
      )
      if (urlRelativeToParent[0] !== ".") {
        // ensure "./" on relative url (otherwise it could be a "bare specifier")
        return `./${urlRelativeToParent}`
      }
      return urlRelativeToParent
    }
    const urlRelativeToBuildDirectory = urlToRelativeUrl(
      generatedUrl,
      buildDirectoryUrl,
    )
    return `${base}${urlRelativeToBuildDirectory}`
  }

  const runBuild = async ({ signal, logLevel }) => {
    const logger = createLogger({ logLevel })
    const buildOperation = Abort.startOperation()
    buildOperation.addAbortSignal(signal)
    const entryPointKeys = Object.keys(entryPoints)
    if (entryPointKeys.length === 1) {
      logger.info(`
build "${entryPointKeys[0]}"`)
    } else {
      logger.info(`
build ${entryPointKeys.length} entry points`)
    }
    const useExplicitJsClassicConversion = entryPointKeys.some((key) =>
      entryPoints[key].includes("?as_js_classic"),
    )
    const rawRedirections = new Map()
    const bundleRedirections = new Map()
    const bundleInternalRedirections = new Map()
    const finalRedirections = new Map()
    const versioningRedirections = new Map()
    const entryUrls = []
    const rawGraph = createUrlGraph()
    const contextSharedDuringBuild = {
      systemJsTranspilation: (() => {
        const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node")
        if (nodeRuntimeEnabled) return false
        if (!RUNTIME_COMPAT.isSupported(runtimeCompat, "script_type_module"))
          return true
        if (!RUNTIME_COMPAT.isSupported(runtimeCompat, "import_dynamic"))
          return true
        if (!RUNTIME_COMPAT.isSupported(runtimeCompat, "import_meta"))
          return true
        if (
          versioning &&
          versioningViaImportmap &&
          !RUNTIME_COMPAT.isSupported(runtimeCompat, "importmap")
        )
          return true
        return false
      })(),
      minification: plugins.some(
        (plugin) => plugin.name === "jsenv:minification",
      ),
    }
    const rawGraphKitchen = createKitchen({
      signal,
      logLevel,
      rootDirectoryUrl,
      urlGraph: rawGraph,
      build: true,
      runtimeCompat,
      ...contextSharedDuringBuild,
      plugins: [
        ...plugins,
        {
          appliesDuring: "build",
          fetchUrlContent: (urlInfo, context) => {
            if (context.reference.original) {
              rawRedirections.set(
                context.reference.original.url,
                context.reference.url,
              )
            }
          },
          formatUrl: (reference) => {
            if (!reference.shouldHandle) {
              return `ignore:${reference.specifier}`
            }
            return null
          },
        },
        ...getCorePlugins({
          rootDirectoryUrl,
          urlGraph: rawGraph,
          runtimeCompat,

          urlAnalysis,
          urlResolution,
          fileSystemMagicRedirection,
          directoryReferenceAllowed,
          transpilation: {
            ...transpilation,
            babelHelpersAsImport: !useExplicitJsClassicConversion,
            jsClassicFallback: false,
          },
          scenarioPlaceholders,
        }),
      ],
      sourcemaps,
      sourcemapsSourcesContent,
      writeGeneratedFiles,
      outDirectoryUrl: new URL(`.jsenv/build/`, rootDirectoryUrl),
    })

    const buildUrlsGenerator = createBuildUrlsGenerator({
      buildDirectoryUrl,
      assetsDirectory,
    })
    const buildDirectoryRedirections = new Map()

    const associateBuildUrlAndRawUrl = (buildUrl, rawUrl, reason) => {
      if (urlIsInsideOf(rawUrl, buildDirectoryUrl)) {
        throw new Error(`raw url must be inside rawGraph, got ${rawUrl}`)
      }
      logger.debug(`build url generated (${reason})
${ANSI.color(rawUrl, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
`)
      buildDirectoryRedirections.set(buildUrl, rawUrl)
    }
    const buildUrls = new Map()
    const bundleUrlInfos = {}
    const bundlers = {}
    const finalGraph = createUrlGraph()
    const urlAnalysisPlugin = jsenvPluginUrlAnalysis({
      rootDirectoryUrl,
      ...urlAnalysis,
    })
    const finalGraphKitchen = createKitchen({
      logLevel,
      rootDirectoryUrl: buildDirectoryUrl,
      urlGraph: finalGraph,
      build: true,
      runtimeCompat,
      ...contextSharedDuringBuild,
      plugins: [
        urlAnalysisPlugin,
        ...(lineBreakNormalization
          ? [jsenvPluginLineBreakNormalization()]
          : []),
        jsenvPluginAsJsClassic({
          jsClassicLibrary: false,
          jsClassicFallback: true,
          systemJsInjection: true,
        }),
        jsenvPluginInline({
          fetchInlineUrls: false,
        }),
        {
          name: "jsenv:build",
          appliesDuring: "build",
          resolveUrl: (reference) => {
            const getUrl = () => {
              if (reference.type === "filesystem") {
                const parentRawUrl = buildDirectoryRedirections.get(
                  reference.parentUrl,
                )
                const parentUrl = ensurePathnameTrailingSlash(parentRawUrl)
                return new URL(reference.specifier, parentUrl).href
              }
              if (reference.specifier[0] === "/") {
                return new URL(reference.specifier.slice(1), buildDirectoryUrl)
                  .href
              }
              return new URL(
                reference.specifier,
                reference.baseUrl || reference.parentUrl,
              ).href
            }
            let url = getUrl()
            //  url = rawRedirections.get(url) || url
            url = bundleRedirections.get(url) || url
            url = bundleInternalRedirections.get(url) || url
            return url
          },
          // redirecting urls into the build directory
          redirectUrl: (reference) => {
            if (!reference.url.startsWith("file:")) {
              return null
            }
            // referenced by resource hint
            // -> keep it untouched, it will be handled by "resync_resource_hints"
            if (reference.isResourceHint) {
              return reference.original ? reference.original.url : null
            }
            // already a build url
            const rawUrl = buildDirectoryRedirections.get(reference.url)
            if (rawUrl) {
              return reference.url
            }
            if (reference.isInline) {
              const rawUrlInfo = GRAPH.find(rawGraph, (rawUrlInfo) => {
                if (!rawUrlInfo.isInline) {
                  return false
                }
                if (rawUrlInfo.content === reference.content) {
                  return true
                }
                return rawUrlInfo.originalContent === reference.content
              })
              const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl)
              if (!rawUrlInfo) {
                // generated during final graph
                // (happens for JSON.parse injected for import assertions for instance)
                // throw new Error(`cannot find raw url for "${reference.url}"`)
                return reference.url
              }
              const buildUrl = buildUrlsGenerator.generate(reference.url, {
                urlInfo: rawUrlInfo,
                parentUrlInfo,
              })
              associateBuildUrlAndRawUrl(
                buildUrl,
                rawUrlInfo.url,
                "inline content",
              )
              return buildUrl
            }
            // from "js_module_as_js_classic":
            //   - injecting "?as_js_classic" for the first time
            //   - injecting "?as_js_classic" because the parentUrl has it
            if (reference.original) {
              const urlBeforeRedirect = reference.original.url
              const urlAfterRedirect = reference.url
              const isEntryPoint =
                reference.isEntryPoint ||
                isWebWorkerEntryPointReference(reference)
              // the url info do not exists yet (it will be created after this "redirectUrl" hook)
              // And the content will be generated when url is cooked by url graph loader.
              // Here we just want to reserve an url for that file
              const urlInfo = {
                data: reference.data,
                isEntryPoint,
                type: reference.expectedType,
                subtype: reference.expectedSubtype,
                filename: reference.filename,
              }
              if (urlIsInsideOf(urlBeforeRedirect, buildDirectoryUrl)) {
                // the redirection happened on a build url, happens due to:
                // 1. bundling
                const buildUrl = buildUrlsGenerator.generate(urlAfterRedirect, {
                  urlInfo,
                })
                finalRedirections.set(urlBeforeRedirect, buildUrl)
                return buildUrl
              }
              const rawUrl = urlAfterRedirect
              const buildUrl = buildUrlsGenerator.generate(rawUrl, {
                urlInfo,
              })
              finalRedirections.set(urlBeforeRedirect, buildUrl)
              associateBuildUrlAndRawUrl(
                buildUrl,
                rawUrl,
                "redirected during postbuild",
              )
              return buildUrl
            }
            // from "js_module_as_js_classic":
            //   - to inject "s.js"
            if (reference.injected) {
              const buildUrl = buildUrlsGenerator.generate(reference.url, {
                urlInfo: {
                  data: {},
                  type: "js_classic",
                },
              })
              associateBuildUrlAndRawUrl(
                buildUrl,
                reference.url,
                "injected during postbuild",
              )
              finalRedirections.set(buildUrl, buildUrl)
              return buildUrl
            }
            const rawUrlInfo = rawGraph.getUrlInfo(reference.url)
            const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl)
            // files from root directory but not given to rollup nor postcss
            if (rawUrlInfo) {
              const referencedUrlObject = new URL(reference.url)
              referencedUrlObject.searchParams.delete("as_js_classic_library")
              const buildUrl = buildUrlsGenerator.generate(
                referencedUrlObject.href,
                {
                  urlInfo: rawUrlInfo,
                  parentUrlInfo,
                },
              )
              associateBuildUrlAndRawUrl(buildUrl, rawUrlInfo.url, "raw file")
              if (buildUrl.includes("?")) {
                associateBuildUrlAndRawUrl(
                  asUrlWithoutSearch(buildUrl),
                  rawUrlInfo.url,
                  "raw file",
                )
              }
              return buildUrl
            }
            if (reference.type === "sourcemap_comment") {
              // inherit parent build url
              return generateSourcemapFileUrl(reference.parentUrl)
            }
            // files generated during the final graph:
            // - sourcemaps
            // const finalUrlInfo = finalGraph.getUrlInfo(url)
            const buildUrl = buildUrlsGenerator.generate(reference.url, {
              urlInfo: {
                data: {},
                type: "asset",
              },
            })
            return buildUrl
          },
          formatUrl: (reference) => {
            if (!reference.generatedUrl.startsWith("file:")) {
              if (!versioning && reference.generatedUrl.startsWith("ignore:")) {
                return reference.generatedUrl.slice("ignore:".length)
              }
              return null
            }
            if (reference.isResourceHint) {
              return null
            }
            if (!urlIsInsideOf(reference.generatedUrl, buildDirectoryUrl)) {
              throw new Error(
                `urls should be inside build directory at this stage, found "${reference.url}"`,
              )
            }
            const generatedUrlObject = new URL(reference.generatedUrl)
            generatedUrlObject.searchParams.delete("js_classic")
            generatedUrlObject.searchParams.delete("js_module")
            generatedUrlObject.searchParams.delete("as_js_classic")
            generatedUrlObject.searchParams.delete("as_js_classic_library")
            generatedUrlObject.searchParams.delete("as_js_module")
            generatedUrlObject.searchParams.delete("as_json_module")
            generatedUrlObject.searchParams.delete("as_css_module")
            generatedUrlObject.searchParams.delete("as_text_module")
            generatedUrlObject.hash = ""
            const generatedUrl = generatedUrlObject.href
            const specifier = asFormattedBuildUrl(generatedUrl, reference)
            buildUrls.set(specifier, reference.generatedUrl)
            return specifier
          },
          fetchUrlContent: async (finalUrlInfo, context) => {
            const fromBundleOrRawGraph = (url) => {
              const bundleUrlInfo = bundleUrlInfos[url]
              if (bundleUrlInfo) {
                // logger.debug(`fetching from bundle ${url}`)
                return bundleUrlInfo
              }
              const rawUrl = buildDirectoryRedirections.get(url) || url
              const rawUrlInfo = rawGraph.getUrlInfo(rawUrl)
              if (!rawUrlInfo) {
                throw new Error(
                  createDetailedMessage(`Cannot find url`, {
                    url,
                    "raw urls": Array.from(buildDirectoryRedirections.values()),
                    "build urls": Array.from(buildDirectoryRedirections.keys()),
                  }),
                )
              }
              // logger.debug(`fetching from raw graph ${url}`)
              if (rawUrlInfo.isInline) {
                // Inline content, such as <script> inside html, is transformed during the previous phase.
                // If we read the inline content it would be considered as the original content.
                // - It could be "fixed" by taking into account sourcemap and consider sourcemap sources
                //   as the original content.
                //   - But it would not work when sourcemap are not generated
                //   - would be a bit slower
                // - So instead of reading the inline content directly, we search into raw graph
                //   to get "originalContent" and "sourcemap"
                finalUrlInfo.type = rawUrlInfo.type
                finalUrlInfo.subtype = rawUrlInfo.subtype
                return rawUrlInfo
              }
              return rawUrlInfo
            }
            const { reference } = context
            // reference injected during "postbuild":
            // - happens for "as_js_classic" injecting "s.js"
            if (reference.injected) {
              const [ref, rawUrlInfo] = rawGraphKitchen.injectReference({
                ...reference,
                parentUrl: buildDirectoryRedirections.get(reference.parentUrl),
              })
              await rawGraphKitchen.cook(rawUrlInfo, { reference: ref })
              return rawUrlInfo
            }
            if (reference.isInline) {
              return fromBundleOrRawGraph(reference.url)
            }
            // reference updated during "postbuild":
            // - happens for "as_js_classic"
            if (reference.original) {
              return fromBundleOrRawGraph(reference.original.url)
            }
            return fromBundleOrRawGraph(finalUrlInfo.url)
          },
        },
        {
          name: "jsenv:optimize",
          appliesDuring: "build",
          finalizeUrlContent: async (urlInfo, context) => {
            await rawGraphKitchen.pluginController.callAsyncHooks(
              "optimizeUrlContent",
              urlInfo,
              context,
              async (optimizeReturnValue) => {
                await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(
                  urlInfo,
                  optimizeReturnValue,
                )
              },
            )
          },
        },
      ],
      sourcemaps,
      sourcemapsSourcesContent,
      sourcemapsSourcesRelative: !versioning,
      writeGeneratedFiles,
      outDirectoryUrl: new URL(".jsenv/postbuild/", rootDirectoryUrl),
    })
    const finalEntryUrls = []

    craft: {
      const generateSourceGraph = createTaskLog("generate source graph", {
        disabled: logger.levels.debug || !logger.levels.info,
      })
      try {
        if (writeGeneratedFiles) {
          await ensureEmptyDirectory(new URL(`.jsenv/build/`, rootDirectoryUrl))
        }
        const rawUrlGraphLoader = createUrlGraphLoader(
          rawGraphKitchen.kitchenContext,
        )
        Object.keys(entryPoints).forEach((key) => {
          const [entryReference, entryUrlInfo] =
            rawGraphKitchen.kitchenContext.prepareEntryPoint({
              trace: { message: `"${key}" in entryPoints parameter` },
              parentUrl: rootDirectoryUrl,
              type: "entry_point",
              specifier: key,
            })
          entryUrls.push(entryUrlInfo.url)
          entryUrlInfo.filename = entryPoints[key]
          entryUrlInfo.isEntryPoint = true
          rawUrlGraphLoader.load(entryUrlInfo, { reference: entryReference })
        })
        await rawUrlGraphLoader.getAllLoadDonePromise(buildOperation)
      } catch (e) {
        generateSourceGraph.fail()
        throw e
      }
      generateSourceGraph.done()
    }

    shape: {
      bundle: {
        rawGraphKitchen.pluginController.plugins.forEach((plugin) => {
          const bundle = plugin.bundle
          if (!bundle) {
            return
          }
          if (typeof bundle !== "object") {
            throw new Error(
              `bundle must be an object, found "${bundle}" on plugin named "${plugin.name}"`,
            )
          }
          Object.keys(bundle).forEach((type) => {
            const bundleFunction = bundle[type]
            if (!bundleFunction) {
              return
            }
            const bundlerForThatType = bundlers[type]
            if (bundlerForThatType) {
              // first plugin to define a bundle hook wins
              return
            }
            bundlers[type] = {
              plugin,
              bundleFunction: bundle[type],
              urlInfos: [],
            }
          })
        })
        const addToBundlerIfAny = (rawUrlInfo) => {
          const bundler = bundlers[rawUrlInfo.type]
          if (bundler) {
            bundler.urlInfos.push(rawUrlInfo)
          }
        }
        GRAPH.forEach(rawGraph, (rawUrlInfo) => {
          // cleanup unused urls (avoid bundling things that are not actually used)
          // happens for:
          // - js import assertions
          // - as_js_classic_library
          if (!isUsed(rawUrlInfo)) {
            rawGraph.deleteUrlInfo(rawUrlInfo.url)
            return
          }
          if (rawUrlInfo.isEntryPoint) {
            addToBundlerIfAny(rawUrlInfo)
          }
          if (rawUrlInfo.type === "html") {
            rawUrlInfo.dependencies.forEach((dependencyUrl) => {
              const dependencyUrlInfo = rawGraph.getUrlInfo(dependencyUrl)
              if (dependencyUrlInfo.isInline) {
                if (dependencyUrlInfo.type === "js_module") {
                  // bundle inline script type module deps
                  dependencyUrlInfo.references.forEach((inlineScriptRef) => {
                    if (inlineScriptRef.type === "js_import") {
                      const inlineUrlInfo = rawGraph.getUrlInfo(
                        inlineScriptRef.url,
                      )
                      addToBundlerIfAny(inlineUrlInfo)
                    }
                  })
                }
                // inline content cannot be bundled
                return
              }
              addToBundlerIfAny(dependencyUrlInfo)
            })
            rawUrlInfo.references.forEach((reference) => {
              if (
                reference.isResourceHint &&
                reference.expectedType === "js_module"
              ) {
                const referencedUrlInfo = rawGraph.getUrlInfo(reference.url)
                if (
                  referencedUrlInfo &&
                  // something else than the resource hint is using this url
                  referencedUrlInfo.dependents.size > 0
                ) {
                  addToBundlerIfAny(referencedUrlInfo)
                }
              }
            })
            return
          }
          // File referenced with new URL('./file.js', import.meta.url)
          // are entry points that should be bundled
          // For instance we will bundle service worker/workers detected like this
          if (rawUrlInfo.type === "js_module") {
            rawUrlInfo.references.forEach((reference) => {
              if (reference.type !== "js_url") {
                return
              }
              const referencedUrlInfo = rawGraph.getUrlInfo(reference.url)
              const bundler = bundlers[referencedUrlInfo.type]
              if (!bundler) {
                return
              }

              let willAlreadyBeBundled = true
              for (const dependent of referencedUrlInfo.dependents) {
                const dependentUrlInfo = rawGraph.getUrlInfo(dependent)
                for (const reference of dependentUrlInfo.references) {
                  if (reference.url === referencedUrlInfo.url) {
                    willAlreadyBeBundled =
                      reference.subtype === "import_dynamic" ||
                      reference.type === "script"
                  }
                }
              }
              if (!willAlreadyBeBundled) {
                bundler.urlInfos.push(referencedUrlInfo)
              }
            })
          }
        })
        await Object.keys(bundlers).reduce(async (previous, type) => {
          await previous
          const bundler = bundlers[type]
          const urlInfosToBundle = bundler.urlInfos
          if (urlInfosToBundle.length === 0) {
            return
          }
          const bundleTask = createTaskLog(`bundle "${type}"`, {
            disabled: logger.levels.debug || !logger.levels.info,
          })
          try {
            const bundlerGeneratedUrlInfos =
              await rawGraphKitchen.pluginController.callAsyncHook(
                {
                  plugin: bundler.plugin,
                  hookName: "bundle",
                  value: bundler.bundleFunction,
                },
                urlInfosToBundle,
                {
                  ...rawGraphKitchen.kitchenContext,
                  buildDirectoryUrl,
                  assetsDirectory,
                },
              )
            Object.keys(bundlerGeneratedUrlInfos).forEach((url) => {
              const rawUrlInfo = rawGraph.getUrlInfo(url)
              const bundlerGeneratedUrlInfo = bundlerGeneratedUrlInfos[url]
              const bundleUrlInfo = {
                type,
                subtype: rawUrlInfo ? rawUrlInfo.subtype : undefined,
                isEntryPoint: rawUrlInfo ? rawUrlInfo.isEntryPoint : undefined,
                filename: rawUrlInfo ? rawUrlInfo.filename : undefined,
                originalUrl: rawUrlInfo ? rawUrlInfo.originalUrl : undefined,
                originalContent: rawUrlInfo
                  ? rawUrlInfo.originalContent
                  : undefined,
                ...bundlerGeneratedUrlInfo,
                data: {
                  ...(rawUrlInfo ? rawUrlInfo.data : {}),
                  ...bundlerGeneratedUrlInfo.data,
                  fromBundle: true,
                },
              }
              if (bundlerGeneratedUrlInfo.sourceUrls) {
                bundlerGeneratedUrlInfo.sourceUrls.forEach((sourceUrl) => {
                  const sourceRawUrlInfo = rawGraph.getUrlInfo(sourceUrl)
                  if (sourceRawUrlInfo) {
                    sourceRawUrlInfo.data.bundled = true
                  }
                })
              }
              const buildUrl = buildUrlsGenerator.generate(url, {
                urlInfo: bundleUrlInfo,
              })
              bundleRedirections.set(url, buildUrl)
              if (urlIsInsideOf(url, buildDirectoryUrl)) {
                if (bundlerGeneratedUrlInfo.data.isDynamicEntry) {
                  const rawUrlInfo = rawGraph.getUrlInfo(
                    bundlerGeneratedUrlInfo.originalUrl,
                  )
                  rawUrlInfo.data.bundled = false
                  bundleRedirections.set(
                    bundlerGeneratedUrlInfo.originalUrl,
                    buildUrl,
                  )
                  associateBuildUrlAndRawUrl(
                    buildUrl,
                    bundlerGeneratedUrlInfo.originalUrl,
                    "bundle",
                  )
                } else {
                  bundleUrlInfo.data.generatedToShareCode = true
                }
              } else {
                associateBuildUrlAndRawUrl(buildUrl, url, "bundle")
              }
              bundleUrlInfos[buildUrl] = bundleUrlInfo
              if (buildUrl.includes("?")) {
                bundleUrlInfos[asUrlWithoutSearch(buildUrl)] = bundleUrlInfo
              }
              if (bundlerGeneratedUrlInfo.data.bundleRelativeUrl) {
                const urlForBundler = new URL(
                  bundlerGeneratedUrlInfo.data.bundleRelativeUrl,
                  buildDirectoryUrl,
                ).href
                if (urlForBundler !== buildUrl) {
                  bundleInternalRedirections.set(urlForBundler, buildUrl)
                }
              }
            })
          } catch (e) {
            bundleTask.fail()
            throw e
          }
          bundleTask.done()
        }, Promise.resolve())
      }
      reload_in_build_directory: {
        const generateBuildGraph = createTaskLog("generate build graph", {
          disabled: logger.levels.debug || !logger.levels.info,
        })
        try {
          if (writeGeneratedFiles) {
            await ensureEmptyDirectory(
              new URL(`.jsenv/postbuild/`, rootDirectoryUrl),
            )
          }
          const finalUrlGraphLoader = createUrlGraphLoader(
            finalGraphKitchen.kitchenContext,
          )
          entryUrls.forEach((entryUrl) => {
            const [finalEntryReference, finalEntryUrlInfo] =
              finalGraphKitchen.kitchenContext.prepareEntryPoint({
                trace: { message: `entryPoint` },
                parentUrl: rootDirectoryUrl,
                type: "entry_point",
                specifier: entryUrl,
              })
            finalEntryUrls.push(finalEntryUrlInfo.url)
            finalUrlGraphLoader.load(finalEntryUrlInfo, {
              reference: finalEntryReference,
            })
          })
          await finalUrlGraphLoader.getAllLoadDonePromise(buildOperation)
        } catch (e) {
          generateBuildGraph.fail()
          throw e
        }
        generateBuildGraph.done()
      }
    }

    const versionMap = new Map()
    const versionedUrlMap = new Map()
    refine: {
      inject_version_in_urls: {
        if (!versioning) {
          break inject_version_in_urls
        }
        const versioningTask = createTaskLog("inject version in urls", {
          disabled: logger.levels.debug || !logger.levels.info,
        })
        try {
          const canUseImportmap =
            versioningViaImportmap &&
            finalEntryUrls.every((finalEntryUrl) => {
              const finalEntryUrlInfo = finalGraph.getUrlInfo(finalEntryUrl)
              return finalEntryUrlInfo.type === "html"
            }) &&
            finalGraphKitchen.kitchenContext.isSupportedOnCurrentClients(
              "importmap",
            )
          const workerReferenceSet = new Set()
          const isReferencedByWorker = (reference, graph) => {
            if (workerReferenceSet.has(reference)) {
              return true
            }
            const urlInfo = graph.getUrlInfo(reference.url)
            const dependentWorker = graph.findDependent(
              urlInfo,
              (dependentUrlInfo) => {
                return isWebWorkerUrlInfo(dependentUrlInfo)
              },
            )
            if (dependentWorker) {
              workerReferenceSet.add(reference)
              return true
            }
            return Boolean(dependentWorker)
          }
          const preferWithoutVersioning = (reference) => {
            const parentUrlInfo = finalGraph.getUrlInfo(reference.parentUrl)
            if (parentUrlInfo.jsQuote) {
              return {
                type: "global",
                source: `${parentUrlInfo.jsQuote}+__v__(${JSON.stringify(
                  reference.specifier,
                )})+${parentUrlInfo.jsQuote}`,
              }
            }
            if (reference.type === "js_url") {
              return {
                type: "global",
                source: `__v__(${JSON.stringify(reference.specifier)})`,
              }
            }
            if (reference.type === "js_import") {
              if (reference.subtype === "import_dynamic") {
                return {
                  type: "global",
                  source: `__v__(${JSON.stringify(reference.specifier)})`,
                }
              }
              if (reference.subtype === "import_meta_resolve") {
                return {
                  type: "global",
                  source: `__v__(${JSON.stringify(reference.specifier)})`,
                }
              }
              if (
                canUseImportmap &&
                !isReferencedByWorker(reference, finalGraph)
              ) {
                return {
                  type: "importmap",
                  source: JSON.stringify(reference.specifier),
                }
              }
            }
            return null
          }

          // see also https://github.com/rollup/rollup/pull/4543
          const contentVersionMap = new Map()
          const hashCallbacks = []
          GRAPH.forEach(finalGraph, (urlInfo) => {
            if (urlInfo.url.startsWith("data:")) {
              return
            }
            if (urlInfo.type === "sourcemap") {
              return
            }
            // ignore:
            // - inline files:
            //   they are already taken into account in the file where they appear
            // - ignored files:
            //   we don't know their content
            // - unused files without reference
            //   File updated such as style.css -> style.css.js or file.js->file.nomodule.js
            //   Are used at some point just to be discarded later because they need to be converted
            //   There is no need to version them and we could not because the file have been ignored
            //   so their content is unknown
            if (urlInfo.isInline) {
              return
            }
            if (!urlInfo.shouldHandle) {
              return
            }
            if (urlInfo.dependents.size === 0 && !urlInfo.isEntryPoint) {
              return
            }
            const urlContent =
              urlInfo.type === "html"
                ? stringifyHtmlAst(
                    parseHtmlString(urlInfo.content, {
                      storeOriginalPositions: false,
                    }),
                    { cleanupJsenvAttributes: true },
                  )
                : urlInfo.content
            const contentVersionGenerator = createVersionGenerator()
            contentVersionGenerator.augmentWithContent(urlContent)
            const contentVersion = contentVersionGenerator.generate()
            contentVersionMap.set(urlInfo.url, contentVersion)
            const versionMutations = []
            const seen = new Set()
            const visitReferences = (urlInfo) => {
              urlInfo.references.forEach((reference) => {
                if (seen.has(reference)) return
                seen.add(reference)
                const referencedUrlInfo = finalGraph.getUrlInfo(reference.url)
                versionMutations.push(() => {
                  const dependencyContentVersion = contentVersionMap.get(
                    reference.url,
                  )
                  if (!dependencyContentVersion) {
                    // no content generated for this dependency
                    // (inline, data:, sourcemap, shouldHandle is false, ...)
                    return null
                  }
                  if (preferWithoutVersioning(reference)) {
                    // when versioning is dynamic no need to take into account
                    // happens for:
                    // - specifier mapped by window.__v__()
                    // - specifier mapped by importmap
                    return null
                  }
                  return dependencyContentVersion
                })
                visitReferences(referencedUrlInfo)
              })
            }
            visitReferences(urlInfo)

            hashCallbacks.push(() => {
              let version
              if (versionMutations.length === 0) {
                version = contentVersion
              } else {
                const versionGenerator = createVersionGenerator()
                versionGenerator.augment(contentVersion)
                versionMutations.forEach((versionMutation) => {
                  const value = versionMutation()
                  if (value) {
                    versionGenerator.augment(value)
                  }
                })
                version = versionGenerator.generate()
              }
              versionMap.set(urlInfo.url, version)
              const buildUrlObject = new URL(urlInfo.url)
              // remove ?as_js_classic as
              // this information is already hold into ".nomodule"
              buildUrlObject.searchParams.delete("as_js_classic")
              buildUrlObject.searchParams.delete("as_js_classic_library")
              buildUrlObject.searchParams.delete("as_js_module")
              buildUrlObject.searchParams.delete("as_json_module")
              buildUrlObject.searchParams.delete("as_css_module")
              buildUrlObject.searchParams.delete("as_text_module")
              const buildUrl = buildUrlObject.href
              finalRedirections.set(urlInfo.url, buildUrl)
              versionedUrlMap.set(
                urlInfo.url,
                normalizeUrl(
                  injectVersionIntoBuildUrl({
                    buildUrl,
                    version,
                    versioningMethod,
                  }),
                ),
              )
            })
          })
          hashCallbacks.forEach((callback) => {
            callback()
          })

          const versionMappings = {}
          const versionMappingsOnGlobalMap = new Set()
          const versionMappingsOnImportmap = new Set()
          const versioningKitchen = createKitchen({
            logLevel: logger.level,
            rootDirectoryUrl: buildDirectoryUrl,
            urlGraph: finalGraph,
            build: true,
            runtimeCompat,
            ...contextSharedDuringBuild,
            plugins: [
              urlAnalysisPlugin,
              jsenvPluginInline({
                fetchInlineUrls: false,
                analyzeConvertedScripts: true, // to be able to version their urls
                allowEscapeForVersioning: true,
              }),
              {
                name: "jsenv:versioning",
                appliesDuring: "build",
                resolveUrl: (reference) => {
                  const buildUrl = buildUrls.get(reference.specifier)
                  if (buildUrl) {
                    return buildUrl
                  }
                  const urlObject = new URL(
                    reference.specifier,
                    reference.baseUrl || reference.parentUrl,
                  )
                  const url = urlObject.href
                  // during versioning we revisit the deps
                  // but the code used to enforce trailing slash on directories
                  // is not applied because "jsenv:file_url_resolution" is not used
                  // so here we search if the url with a trailing slash exists
                  if (
                    reference.type === "filesystem" &&
                    !urlObject.pathname.endsWith("/")
                  ) {
                    const urlWithTrailingSlash = `${url}/`
                    const specifier = findKey(buildUrls, urlWithTrailingSlash)
                    if (specifier) {
                      return urlWithTrailingSlash
                    }
                  }
                  return url
                },
                formatUrl: (reference) => {
                  if (!reference.shouldHandle) {
                    if (reference.generatedUrl.startsWith("ignore:")) {
                      return reference.generatedUrl.slice("ignore:".length)
                    }
                    return null
                  }
                  if (reference.isInline || reference.url.startsWith("data:")) {
                    return null
                  }
                  if (reference.isResourceHint) {
                    return null
                  }
                  // specifier comes from "normalize" hook done a bit earlier in this file
                  // we want to get back their build url to access their infos
                  const referencedUrlInfo = finalGraph.getUrlInfo(reference.url)
                  if (!canUseVersionedUrl(referencedUrlInfo)) {
                    return reference.specifier
                  }
                  if (!referencedUrlInfo.shouldHandle) {
                    return null
                  }
                  const versionedUrl = versionedUrlMap.get(reference.url)
                  if (!versionedUrl) {
                    // happens for sourcemap
                    return urlToRelativeUrl(
                      referencedUrlInfo.url,
                      reference.parentUrl,
                    )
                  }
                  const versionedSpecifier = asFormattedBuildUrl(
                    versionedUrl,
                    reference,
                  )
                  versionMappings[reference.specifier] = versionedSpecifier
                  versioningRedirections.set(reference.url, versionedUrl)
                  buildUrls.set(versionedSpecifier, versionedUrl)

                  const withoutVersioning = preferWithoutVersioning(reference)
                  if (withoutVersioning) {
                    if (withoutVersioning.type === "importmap") {
                      versionMappingsOnImportmap.add(reference.specifier)
                    } else {
                      versionMappingsOnGlobalMap.add(reference.specifier)
                    }
                    return () => withoutVersioning.source
                  }
                  return versionedSpecifier
                },
                fetchUrlContent: (versionedUrlInfo) => {
                  if (versionedUrlInfo.isInline) {
                    const rawUrlInfo = rawGraph.getUrlInfo(
                      buildDirectoryRedirections.get(versionedUrlInfo.url),
                    )
                    const finalUrlInfo = finalGraph.getUrlInfo(
                      versionedUrlInfo.url,
                    )
                    return {
                      content: versionedUrlInfo.content,
                      contentType: versionedUrlInfo.contentType,
                      originalContent: rawUrlInfo
                        ? rawUrlInfo.originalContent
                        : undefined,
                      sourcemap: finalUrlInfo
                        ? finalUrlInfo.sourcemap
                        : undefined,
                    }
                  }
                  return versionedUrlInfo
                },
              },
            ],
            sourcemaps,
            sourcemapsSourcesContent,
            sourcemapsSourcesRelative: true,
            writeGeneratedFiles,
            outDirectoryUrl: new URL(
              ".jsenv/postbuild/",
              finalGraphKitchen.rootDirectoryUrl,
            ),
          })
          const versioningUrlGraphLoader = createUrlGraphLoader(
            versioningKitchen.kitchenContext,
          )
          finalEntryUrls.forEach((finalEntryUrl) => {
            const [finalEntryReference, finalEntryUrlInfo] =
              finalGraphKitchen.kitchenContext.prepareEntryPoint({
                trace: { message: `entryPoint` },
                parentUrl: buildDirectoryUrl,
                type: "entry_point",
                specifier: finalEntryUrl,
              })
            versioningUrlGraphLoader.load(finalEntryUrlInfo, {
              reference: finalEntryReference,
            })
          })
          await versioningUrlGraphLoader.getAllLoadDonePromise(buildOperation)
          workerReferenceSet.clear()
          const actions = []
          const visitors = []
          if (versionMappingsOnImportmap.size) {
            const versionMappingsNeeded = {}
            versionMappingsOnImportmap.forEach((specifier) => {
              versionMappingsNeeded[specifier] = versionMappings[specifier]
            })
            visitors.push((urlInfo) => {
              if (urlInfo.type === "html" && urlInfo.isEntryPoint) {
                actions.push(async () => {
                  await injectVersionMappingsAsImportmap({
                    urlInfo,
                    kitchen: finalGraphKitchen,
                    versionMappings: versionMappingsNeeded,
                  })
                })
              }
            })
          }
          if (versionMappingsOnGlobalMap.size) {
            const versionMappingsNeeded = {}
            versionMappingsOnGlobalMap.forEach((specifier) => {
              versionMappingsNeeded[specifier] = versionMappings[specifier]
            })
            visitors.push((urlInfo) => {
              if (urlInfo.isEntryPoint) {
                actions.push(async () => {
                  await injectVersionMappingsAsGlobal({
                    urlInfo,
                    kitchen: finalGraphKitchen,
                    versionMappings: versionMappingsNeeded,
                  })
                })
              }
            })
          }
          if (visitors.length) {
            GRAPH.forEach(finalGraph, (urlInfo) => {
              visitors.forEach((visitor) => visitor(urlInfo))
            })
            if (actions.length) {
              await Promise.all(actions.map((action) => action()))
            }
          }
        } catch (e) {
          versioningTask.fail()
          throw e
        }
        versioningTask.done()
      }
      cleanup_jsenv_attributes_from_html: {
        GRAPH.forEach(finalGraph, (urlInfo) => {
          if (!urlInfo.shouldHandle) {
            return
          }
          if (!urlInfo.url.startsWith("file:")) {
            return
          }
          if (urlInfo.type === "html") {
            const htmlAst = parseHtmlString(urlInfo.content, {
              storeOriginalPositions: false,
            })
            urlInfo.content = stringifyHtmlAst(htmlAst, {
              cleanupJsenvAttributes: true,
            })
          }
        })
      }
      /*
       * Update <link rel="preload"> and friends after build (once we know everything)
       * - Used to remove resource hint targeting an url that is no longer used:
       *   - because of bundlings
       *   - because of import assertions transpilation (file is inlined into JS)
       */
      resync_resource_hints: {
        const actions = []
        GRAPH.forEach(finalGraph, (urlInfo) => {
          if (urlInfo.type !== "html") {
            return
          }
          actions.push(async () => {
            const htmlAst = parseHtmlString(urlInfo.content, {
              storeOriginalPositions: false,
            })
            const mutations = []
            const hintsToInject = {}
            visitHtmlNodes(htmlAst, {
              link: (node) => {
                const href = getHtmlNodeAttribute(node, "href")
                if (href === undefined || href.startsWith("data:")) {
                  return
                }
                const rel = getHtmlNodeAttribute(node, "rel")
                const isResourceHint = [
                  "preconnect",
                  "dns-prefetch",
                  "prefetch",
                  "preload",
                  "modulepreload",
                ].includes(rel)
                if (!isResourceHint) {
                  return
                }
                const onBuildUrl = (buildUrl) => {
                  const buildUrlInfo = buildUrl
                    ? finalGraph.getUrlInfo(buildUrl)
                    : null
                  if (!buildUrlInfo) {
                    logger.warn(
                      `remove resource hint because cannot find "${href}" in the graph`,
                    )
                    mutations.push(() => {
                      removeHtmlNode(node)
                    })
                    return
                  }
                  if (buildUrlInfo.dependents.size === 0) {
                    logger.warn(
                      `remove resource hint because "${href}" not used anymore`,
                    )
                    mutations.push(() => {
                      removeHtmlNode(node)
                    })
                    return
                  }
                  const buildUrlFormatted =
                    versioningRedirections.get(buildUrlInfo.url) ||
                    buildUrlInfo.url
                  const buildSpecifierBeforeRedirect = findKey(
                    buildUrls,
                    buildUrlFormatted,
                  )
                  mutations.push(() => {
                    setHtmlNodeAttributes(node, {
                      href: buildSpecifierBeforeRedirect,
                    })
                  })
                  for (const dependencyUrl of buildUrlInfo.dependencies) {
                    const dependencyUrlInfo =
                      finalGraph.urlInfoMap.get(dependencyUrl)
                    if (dependencyUrlInfo.data.generatedToShareCode) {
                      hintsToInject[dependencyUrl] = node
                    }
                  }
                }
                if (href.startsWith("file:")) {
                  let url = href
                  url = rawRedirections.get(url) || url
                  const rawUrlInfo = rawGraph.getUrlInfo(url)
                  if (rawUrlInfo && rawUrlInfo.data.bundled) {
                    logger.warn(
                      `remove resource hint on "${href}" because it was bundled`,
                    )
                    mutations.push(() => {
                      removeHtmlNode(node)
                    })
                  } else {
                    url = bundleRedirections.get(url) || url
                    url = bundleInternalRedirections.get(url) || url
                    url = finalRedirections.get(url) || url
                    url = findKey(buildDirectoryRedirections, url) || url
                    onBuildUrl(url)
                  }
                } else {
                  onBuildUrl(null)
                }
              },
            })
            Object.keys(hintsToInject).forEach((urlToHint) => {
              const hintNode = hintsToInject[urlToHint]
              const urlFormatted =
                versioningRedirections.get(urlToHint) || urlToHint
              const specifierBeforeRedirect = findKey(buildUrls, urlFormatted)
              const found = findHtmlNode(htmlAst, (htmlNode) => {
                return (
                  htmlNode.nodeName === "link" &&
                  getHtmlNodeAttribute(htmlNode, "href") ===
                    specifierBeforeRedirect
                )
              })
              if (!found) {
                mutations.push(() => {
                  const nodeToInsert = createHtmlNode({
                    tagName: "link",
                    href: specifierBeforeRedirect,
                    rel: getHtmlNodeAttribute(hintNode, "rel"),
                    as: getHtmlNodeAttribute(hintNode, "as"),
                    type: getHtmlNodeAttribute(hintNode, "type"),
                    crossorigin: getHtmlNodeAttribute(hintNode, "crossorigin"),
                  })
                  insertHtmlNodeAfter(
                    nodeToInsert,
                    hintNode.parentNode,
                    hintNode,
                  )
                })
              }
            })
            if (mutations.length > 0) {
              mutations.forEach((mutation) => mutation())
              await finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(
                urlInfo,
                {
                  content: stringifyHtmlAst(htmlAst),
                },
              )
            }
          })
        })
        await Promise.all(
          actions.map((resourceHintAction) => resourceHintAction()),
        )
        buildOperation.throwIfAborted()
      }
      delete_unused_urls: {
        const actions = []
        GRAPH.forEach(finalGraph, (urlInfo) => {
          if (!isUsed(urlInfo)) {
            actions.push(() => {
              finalGraph.deleteUrlInfo(urlInfo.url)
            })
          }
        })
        actions.forEach((action) => action())
      }
      inject_urls_in_service_workers: {
        const serviceWorkerEntryUrlInfos = GRAPH.filter(
          finalGraph,
          (finalUrlInfo) => {
            return (
              finalUrlInfo.subtype === "service_worker" &&
              finalUrlInfo.isEntryPoint
            )
          },
        )
        if (serviceWorkerEntryUrlInfos.length > 0) {
          const serviceWorkerResources = {}
          GRAPH.forEach(finalGraph, (urlInfo) => {
            if (urlInfo.isInline || !urlInfo.shouldHandle) {
              return
            }
            if (!urlInfo.url.startsWith("file:")) {
              return
            }
            if (!canUseVersionedUrl(urlInfo)) {
              // when url is not versioned we compute a "version" for that url anyway
              // so that service worker source still changes and navigator
              // detect there is a change
              const specifier = findKey(buildUrls, urlInfo.url)
              serviceWorkerResources[specifier] = {
                version: versionMap.get(urlInfo.url),
              }
              return
            }
            const specifier = findKey(buildUrls, urlInfo.url)
            const versionedUrl = versionedUrlMap.get(urlInfo.url)
            const versionedSpecifier = findKey(buildUrls, versionedUrl)
            serviceWorkerResources[specifier] = {
              version: versionMap.get(urlInfo.url),
              versionedUrl: versionedSpecifier,
            }
          })
          serviceWorkerEntryUrlInfos.forEach((serviceWorkerEntryUrlInfo) => {
            const magicSource = createMagicSource(
              serviceWorkerEntryUrlInfo.content,
            )
            const serviceWorkerResourcesWithoutSwScriptItSelf = {
              ...serviceWorkerResources,
            }
            const serviceWorkerSpecifier = findKey(
              buildUrls,
              serviceWorkerEntryUrlInfo.url,
            )
            delete serviceWorkerResourcesWithoutSwScriptItSelf[
              serviceWorkerSpecifier
            ]
            magicSource.prepend(
              `\nself.resourcesFromJsenvBuild = ${JSON.stringify(
                serviceWorkerResourcesWithoutSwScriptItSelf,
                null,
                "  ",
              )};\n`,
            )
            const { content, sourcemap } = magicSource.toContentAndSourcemap()
            finalGraphKitchen.urlInfoTransformer.applyFinalTransformations(
              serviceWorkerEntryUrlInfo,
              {
                content,
                sourcemap,
              },
            )
          })
        }
        buildOperation.throwIfAborted()
      }
    }

    const buildManifest = {}
    const buildContents = {}
    const buildInlineRelativeUrls = []
    const getBuildRelativeUrl = (url) => {
      const urlObject = new URL(url)
      urlObject.searchParams.delete("as_js_classic")
      urlObject.searchParams.delete("as_css_module")
      urlObject.searchParams.delete("as_json_module")
      urlObject.searchParams.delete("as_text_module")
      url = urlObject.href
      const buildRelativeUrl = urlToRelativeUrl(url, buildDirectoryUrl)
      return buildRelativeUrl
    }
    GRAPH.forEach(finalGraph, (urlInfo) => {
      if (!urlInfo.shouldHandle) {
        return
      }
      if (!urlInfo.url.startsWith("file:")) {
        return
      }
      if (urlInfo.type === "directory") {
        return
      }
      if (urlInfo.isInline) {
        const buildRelativeUrl = getBuildRelativeUrl(urlInfo.url)
        buildContents[buildRelativeUrl] = urlInfo.content
        buildInlineRelativeUrls.push(buildRelativeUrl)
      } else {
        const versionedUrl = versionedUrlMap.get(urlInfo.url)
        if (versionedUrl && canUseVersionedUrl(urlInfo)) {
          const buildRelativeUrl = getBuildRelativeUrl(urlInfo.url)
          const versionedBuildRelativeUrl = getBuildRelativeUrl(versionedUrl)
          if (versioningMethod === "search_param") {
            buildContents[buildRelativeUrl] = urlInfo.content
          } else {
            buildContents[versionedBuildRelativeUrl] = urlInfo.content
          }
          buildManifest[buildRelativeUrl] = versionedBuildRelativeUrl
        } else {
          const buildRelativeUrl = getBuildRelativeUrl(urlInfo.url)
          buildContents[buildRelativeUrl] = urlInfo.content
        }
      }
    })
    const buildFileContents = {}
    const buildInlineContents = {}
    Object.keys(buildContents)
      .sort((a, b) => comparePathnames(a, b))
      .forEach((buildRelativeUrl) => {
        if (buildInlineRelativeUrls.includes(buildRelativeUrl)) {
          buildInlineContents[buildRelativeUrl] =
            buildContents[buildRelativeUrl]
        } else {
          buildFileContents[buildRelativeUrl] = buildContents[buildRelativeUrl]
        }
      })

    if (writeOnFileSystem) {
      if (directoryToClean) {
        await ensureEmptyDirectory(directoryToClean)
      }
      const buildRelativeUrls = Object.keys(buildFileContents)
      buildRelativeUrls.forEach((buildRelativeUrl) => {
        writeFileSync(
          new URL(buildRelativeUrl, buildDirectoryUrl),
          buildFileContents[buildRelativeUrl],
        )
      })
      if (versioning && assetManifest && Object.keys(buildManifest).length) {
        writeFileSync(
          new URL(assetManifestFileRelativeUrl, buildDirectoryUrl),
          JSON.stringify(buildManifest, null, "  "),
        )
      }
    }
    logger.info(createUrlGraphSummary(finalGraph, { title: "build files" }))
    return {
      buildFileContents,
      buildInlineContents,
      buildManifest,
    }
  }

  if (!watch) {
    return runBuild({ signal: operation.signal, logLevel })
  }

  let resolveFirstBuild
  let rejectFirstBuild
  const firstBuildPromise = new Promise((resolve, reject) => {
    resolveFirstBuild = resolve
    rejectFirstBuild = reject
  })
  let buildAbortController
  let watchFilesTask
  const startBuild = async () => {
    const buildTask = createTaskLog("build")
    buildAbortController = new AbortController()
    try {
      const result = await runBuild({
        signal: buildAbortController.signal,
        logLevel: "warn",
      })
      buildTask.done()
      resolveFirstBuild(result)
      watchFilesTask = createTaskLog("watch files")
    } catch (e) {
      if (Abort.isAbortError(e)) {
        buildTask.fail(`build aborted`)
      } else if (e.code === "PARSE_ERROR") {
        buildTask.fail()
        console.error(e.stack)
        watchFilesTask = createTaskLog("watch files")
      } else {
        buildTask.fail()
        rejectFirstBuild(e)
        throw e
      }
    }
  }

  startBuild()
  let startTimeout
  const clientFileChangeCallback = ({ relativeUrl, event }) => {
    const url = new URL(relativeUrl, rootDirectoryUrl).href
    if (watchFilesTask) {
      watchFilesTask.happen(`${url.slice(rootDirectoryUrl.length)} ${event}`)
      watchFilesTask = null
    }
    buildAbortController.abort()
    // setTimeout is to ensure the abortController.abort() above
    // is properly taken into account so that logs about abort comes first
    // then logs about re-running the build happens
    clearTimeout(startTimeout)
    startTimeout = setTimeout(startBuild, 20)
  }
  const stopWatchingClientFiles = registerDirectoryLifecycle(rootDirectoryUrl, {
    watchPatterns: clientFiles,
    cooldownBetweenFileEvents,
    keepProcessAlive: true,
    recursive: true,
    added: ({ relativeUrl }) => {
      clientFileChangeCallback({ relativeUrl, event: "added" })
    },
    updated: ({ relativeUrl }) => {
      clientFileChangeCallback({ relativeUrl, event: "modified" })
    },
    removed: ({ relativeUrl }) => {
      clientFileChangeCallback({ relativeUrl, event: "removed" })
    },
  })
  operation.addAbortCallback(() => {
    stopWatchingClientFiles()
  })
  await firstBuildPromise
  return stopWatchingClientFiles
}

const findKey = (map, value) => {
  for (const [keyCandidate, valueCandidate] of map) {
    if (valueCandidate === value) {
      return keyCandidate
    }
  }
  return undefined
}

const injectVersionIntoBuildUrl = ({ buildUrl, version, versioningMethod }) => {
  if (versioningMethod === "search_param") {
    return injectQueryParams(buildUrl, {
      v: version,
    })
  }
  const basename = urlToBasename(buildUrl)
  const extension = urlToExtension(buildUrl)
  const versionedFilename = `${basename}-${version}${extension}`
  const versionedUrl = setUrlFilename(buildUrl, versionedFilename)
  return versionedUrl
}

const assertEntryPoints = ({ entryPoints }) => {
  if (typeof entryPoints !== "object" || entryPoints === null) {
    throw new TypeError(`entryPoints must be an object, got ${entryPoints}`)
  }
  const keys = Object.keys(entryPoints)
  keys.forEach((key) => {
    if (!key.startsWith("./")) {
      throw new TypeError(
        `unexpected key in entryPoints, all keys must start with ./ but found ${key}`,
      )
    }
    const value = entryPoints[key]
    if (typeof value !== "string") {
      throw new TypeError(
        `unexpected value in entryPoints, all values must be strings found ${value} for key ${key}`,
      )
    }
    if (value.includes("/")) {
      throw new TypeError(
        `unexpected value in entryPoints, all values must be plain strings (no "/") but found ${value} for key ${key}`,
      )
    }
  })
}

const isUsed = (urlInfo) => {
  // nothing uses this url anymore
  // - versioning update inline content
  // - file converted for import assertion or js_classic conversion
  if (urlInfo.isEntryPoint) {
    return true
  }
  if (urlInfo.type === "sourcemap") {
    return true
  }
  if (urlInfo.injected) {
    return true
  }
  return urlInfo.dependents.size > 0
}

const canUseVersionedUrl = (urlInfo) => {
  if (urlInfo.isEntryPoint) {
    return false
  }
  return urlInfo.type !== "webmanifest"
}
