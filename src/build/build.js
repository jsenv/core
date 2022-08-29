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
  assertAndNormalizeDirectoryUrl,
  ensureEmptyDirectory,
  writeFileSync,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import {
  createLogger,
  createTaskLog,
  ANSI,
  createDetailedMessage,
} from "@jsenv/log"
import { generateSourcemapFileUrl } from "@jsenv/sourcemap"
import {
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlNodes,
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
  removeHtmlNode,
} from "@jsenv/ast"

import { sortByDependencies } from "../omega/url_graph/sort_by_dependencies.js"
import { createUrlGraph } from "../omega/url_graph.js"
import { jsenvPluginUrlAnalysis } from "../plugins/url_analysis/jsenv_plugin_url_analysis.js"
import { jsenvPluginInline } from "../plugins/inline/jsenv_plugin_inline.js"
import { jsenvPluginAsJsClassic } from "../plugins/transpilation/as_js_classic/jsenv_plugin_as_js_classic.js"
import { getCorePlugins } from "../plugins/plugins.js"
import { createKitchen } from "../omega/kitchen.js"
import { createUrlGraphLoader } from "../omega/url_graph/url_graph_loader.js"
import { createUrlGraphSummary } from "../omega/url_graph/url_graph_report.js"
import { isWebWorkerEntryPointReference } from "../omega/web_workers.js"

import { GRAPH } from "./graph_utils.js"
import { createBuilUrlsGenerator } from "./build_urls_generator.js"
import { injectGlobalVersionMapping } from "./inject_global_version_mappings.js"
import { createVersionGenerator } from "./version_generator.js"
import { injectServiceWorkerUrls } from "./inject_service_worker_urls.js"

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
 * @param {string="/"} buildParameters.baseUrl
 *        All urls in build file contents are prefixed with this url
 * @param {boolean|object} [buildParameters.minification=true]
 *        Minify build file contents
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
  entryPoints = {},
  baseUrl = "/",

  runtimeCompat = defaultRuntimeCompat,
  plugins = [],
  sourcemaps = false,
  sourcemapsSourcesContent,
  urlAnalysis = {},
  nodeEsmResolution = true,
  fileSystemMagicResolution,
  directoryReferenceAllowed,
  transpilation = {},
  bundling = true,
  minification = true,
  versioning = true,
  versioningMethod = "search_param", // "filename", "search_param"
  lineBreakNormalization = process.platform === "win32",

  clientFiles = {
    "./src/": true,
  },
  cooldownBetweenFileEvents,
  watch = false,

  buildDirectoryClean = true,
  writeOnFileSystem = true,
  writeGeneratedFiles = false,
  assetManifest = true,
  assetManifestFileRelativeUrl = "asset-manifest.json",
}) => {
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

  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  buildDirectoryUrl = assertAndNormalizeDirectoryUrl(buildDirectoryUrl)
  assertEntryPoints({ entryPoints })
  if (!["filename", "search_param"].includes(versioningMethod)) {
    throw new Error(
      `Unexpected "versioningMethod": must be "filename", "search_param"; got ${versioning}`,
    )
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
    const rawGraphKitchen = createKitchen({
      signal,
      logLevel,
      rootDirectoryUrl,
      urlGraph: rawGraph,
      scenarios: { build: true },
      runtimeCompat,
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
          nodeEsmResolution,
          fileSystemMagicResolution,
          directoryReferenceAllowed,
          transpilation: {
            ...transpilation,
            babelHelpersAsImport: !useExplicitJsClassicConversion,
            jsClassicFallback: false,
          },
          minification,
          bundling,
        }),
      ],
      sourcemaps,
      sourcemapsSourcesContent,
      writeGeneratedFiles,
      outDirectoryUrl: new URL(`.jsenv/build/`, rootDirectoryUrl),
    })

    const buildUrlsGenerator = createBuilUrlsGenerator({
      buildDirectoryUrl,
    })
    const buildToRawUrls = {}
    // rename "buildDirectoryRedirections"?
    const associateBuildUrlAndRawUrl = (buildUrl, rawUrl, reason) => {
      if (urlIsInsideOf(rawUrl, buildDirectoryUrl)) {
        throw new Error(`raw url must be inside rawGraph, got ${rawUrl}`)
      }
      logger.debug(`build url generated (${reason})
${ANSI.color(rawUrl, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
`)
      buildToRawUrls[buildUrl] = rawUrl
    }
    const buildUrls = {}
    const bundleUrlInfos = {}
    const bundlers = {}
    const finalGraph = createUrlGraph()
    const urlAnalysisPlugin = jsenvPluginUrlAnalysis({
      rootDirectoryUrl,
      ...urlAnalysis,
    })
    const finalGraphKitchen = createKitchen({
      logLevel,
      rootDirectoryUrl,
      urlGraph: finalGraph,
      scenarios: { build: true },
      runtimeCompat,
      plugins: [
        urlAnalysisPlugin,
        jsenvPluginAsJsClassic({
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
                const parentRawUrl = buildToRawUrls[reference.parentUrl]
                const baseUrl = ensurePathnameTrailingSlash(parentRawUrl)
                return new URL(reference.specifier, baseUrl).href
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
            url = rawRedirections.get(url) || url
            url = bundleRedirections.get(url) || url
            url = bundleInternalRedirections.get(url) || url
            return url
          },
          // redirecting urls into the build directory
          redirectUrl: (reference) => {
            if (!reference.url.startsWith("file:")) {
              return null
            }
            // already a build url
            const rawUrl = buildToRawUrls[reference.url]
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
                if (rawUrlInfo.originalContent === reference.content) {
                  return true
                }
                return false
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
              const buildUrl = buildUrlsGenerator.generate(reference.url, {
                urlInfo: rawUrlInfo,
                parentUrlInfo,
              })
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
            if (!urlIsInsideOf(reference.generatedUrl, buildDirectoryUrl)) {
              throw new Error(
                `urls should be inside build directory at this stage, found "${reference.url}"`,
              )
            }
            const generatedUrlObject = new URL(reference.generatedUrl)
            if (generatedUrlObject.searchParams.has("as_js_classic")) {
              generatedUrlObject.searchParams.delete("as_js_classic")
            }
            // TODO: also remove stuff related to import assertions
            generatedUrlObject.hash = ""
            const generatedUrl = generatedUrlObject.href
            let specifier
            if (baseUrl === "./") {
              const relativeUrl = urlToRelativeUrl(
                generatedUrl,
                reference.parentUrl === rootDirectoryUrl
                  ? buildDirectoryUrl
                  : reference.parentUrl,
              )
              // ensure "./" on relative url (otherwise it could be a "bare specifier")
              specifier =
                relativeUrl[0] === "." ? relativeUrl : `./${relativeUrl}`
            } else {
              // if a file is in the same directory we could prefer the relative notation
              // but to keep things simple let's keep the "absolutely relative" to baseUrl for now
              specifier = `${baseUrl}${urlToRelativeUrl(
                generatedUrl,
                buildDirectoryUrl,
              )}`
            }
            buildUrls[specifier] = reference.generatedUrl
            return specifier
          },
          fetchUrlContent: async (finalUrlInfo, context) => {
            const fromBundleOrRawGraph = (url) => {
              const bundleUrlInfo = bundleUrlInfos[url]
              if (bundleUrlInfo) {
                // logger.debug(`fetching from bundle ${url}`)
                return bundleUrlInfo
              }
              const rawUrl = buildToRawUrls[url] || url
              const rawUrlInfo = rawGraph.getUrlInfo(rawUrl)
              if (!rawUrlInfo) {
                throw new Error(
                  createDetailedMessage(`Cannot find url`, {
                    url,
                    "raw urls": Object.values(buildToRawUrls),
                    "build urls": Object.keys(buildToRawUrls),
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
                type: reference.type,
                expectedType: reference.expectedType,
                expectedSubtype: reference.expectedSubtype,
                parentUrl: buildToRawUrls[reference.parentUrl],
                specifier: reference.specifier,
                injected: true,
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
      sourcemapsRelativeSources: !versioning,
      writeGeneratedFiles,
      outDirectoryUrl: new URL(".jsenv/postbuild/", rootDirectoryUrl),
    })
    const finalEntryUrls = []

    craft: {
      const prebuildTask = createTaskLog("prebuild", {
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
          rawUrlGraphLoader.load(entryUrlInfo, { reference: entryReference })
        })
        await rawUrlGraphLoader.getAllLoadDonePromise(buildOperation)
      } catch (e) {
        prebuildTask.fail()
        throw e
      }
      prebuildTask.done()
    }

    shape: {
      const buildTask = createTaskLog("build", {
        disabled: logger.levels.debug || !logger.levels.info,
      })
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
          return
        }
      }
      GRAPH.forEach(rawGraph, (rawUrlInfo) => {
        if (rawUrlInfo.isEntryPoint) {
          addToBundlerIfAny(rawUrlInfo)
          if (rawUrlInfo.type === "html") {
            rawUrlInfo.dependencies.forEach((dependencyUrl) => {
              const dependencyUrlInfo = rawGraph.getUrlInfo(dependencyUrl)
              if (dependencyUrlInfo.isInline) {
                if (dependencyUrlInfo.type === "js_module") {
                  // bundle inline script type module deps
                  dependencyUrlInfo.references.forEach((inlineScriptRef) => {
                    if (inlineScriptRef.type === "js_import_export") {
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
        }
        // File referenced with new URL('./file.js', import.meta.url)
        // are entry points that can be bundled
        // For instance we will bundle service worker/workers detected like this
        if (rawUrlInfo.type === "js_module") {
          rawUrlInfo.references.forEach((reference) => {
            if (reference.type === "js_url_specifier") {
              const urlInfo = rawGraph.getUrlInfo(reference.url)
              addToBundlerIfAny(urlInfo)
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
            const buildUrl = buildUrlsGenerator.generate(url, {
              urlInfo: bundleUrlInfo,
            })
            bundleRedirections.set(url, buildUrl)
            if (urlIsInsideOf(url, buildDirectoryUrl)) {
              // chunk generated by rollup to share code
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
                bundleInternalRedirections[urlForBundler] = buildUrl
              }
            }
          })
        } catch (e) {
          bundleTask.fail()
          throw e
        }
        bundleTask.done()
      }, Promise.resolve())
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
        buildTask.fail()
        throw e
      }
      buildTask.done()
    }

    refine: {
      inject_version_in_urls: {
        logger.debug(
          `graph urls pre-versioning:
${Array.from(finalGraph.urlInfoMap.keys()).join("\n")}`,
        )
        if (versioning) {
          const versioningTask = createTaskLog("inject version in urls", {
            disabled: logger.levels.debug || !logger.levels.info,
          })
          try {
            const urlsSorted = sortByDependencies(finalGraph.toObject())
            urlsSorted.forEach((url) => {
              if (url.startsWith("data:")) {
                return
              }
              const urlInfo = finalGraph.getUrlInfo(url)
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
              if (!urlInfo.isEntryPoint && urlInfo.dependents.size === 0) {
                return
              }
              const urlContent =
                urlInfo.type === "html"
                  ? stringifyHtmlAst(
                      parseHtmlString(urlInfo.content, {
                        storeOriginalPositions: false,
                      }),
                      { removeOriginalPositionAttributes: true },
                    )
                  : urlInfo.content
              const versionGenerator = createVersionGenerator()
              versionGenerator.augmentWithContent({
                content: urlContent,
                contentType: urlInfo.contentType,
                lineBreakNormalization,
              })
              urlInfo.dependencies.forEach((dependencyUrl) => {
                // this dependency is inline
                if (dependencyUrl.startsWith("data:")) {
                  return
                }
                const dependencyUrlInfo = finalGraph.getUrlInfo(dependencyUrl)
                if (
                  // this content is part of the file, no need to take into account twice
                  dependencyUrlInfo.isInline ||
                  // this dependency content is not known
                  !dependencyUrlInfo.shouldHandle
                ) {
                  return
                }
                if (dependencyUrlInfo.data.version) {
                  versionGenerator.augmentWithDependencyVersion(
                    dependencyUrlInfo.data.version,
                  )
                } else {
                  // because all dependencies are know, if the dependency has no version
                  // it means there is a circular dependency between this file
                  // and it's dependency
                  // in that case we'll use the dependency content
                  versionGenerator.augmentWithContent({
                    content: dependencyUrlInfo.content,
                    contentType: dependencyUrlInfo.contentType,
                    lineBreakNormalization,
                  })
                }
              })
              urlInfo.data.version = versionGenerator.generate()

              const buildUrlObject = new URL(urlInfo.url)
              // remove ?as_js_classic as
              // this information is already hold into ".nomodule"
              if (buildUrlObject.searchParams.has("as_js_classic")) {
                buildUrlObject.searchParams.delete("as_js_classic")
              }
              const buildUrl = buildUrlObject.href
              finalRedirections.set(urlInfo.url, buildUrl)
              urlInfo.data.versionedUrl = normalizeUrl(
                injectVersionIntoBuildUrl({
                  buildUrl,
                  version: urlInfo.data.version,
                  versioningMethod,
                }),
              )
            })
            const versionMappings = {}
            const usedVersionMappings = []
            const versioningKitchen = createKitchen({
              logLevel: logger.level,
              rootDirectoryUrl: buildDirectoryUrl,
              urlGraph: finalGraph,
              scenarios: { build: true },
              runtimeCompat,
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
                    const buildUrl = buildUrls[reference.specifier]
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
                      const specifier = Object.keys(buildUrls).find(
                        (key) => buildUrls[key] === urlWithTrailingSlash,
                      )
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
                    if (
                      reference.isInline ||
                      reference.url.startsWith("data:")
                    ) {
                      return null
                    }
                    // specifier comes from "normalize" hook done a bit earlier in this file
                    // we want to get back their build url to access their infos
                    const referencedUrlInfo = finalGraph.getUrlInfo(
                      reference.url,
                    )
                    if (!canUseVersionedUrl(referencedUrlInfo)) {
                      return reference.specifier
                    }
                    if (!referencedUrlInfo.shouldHandle) {
                      return null
                    }
                    const versionedUrl = referencedUrlInfo.data.versionedUrl
                    if (!versionedUrl) {
                      // happens for sourcemap
                      return `${baseUrl}${urlToRelativeUrl(
                        referencedUrlInfo.url,
                        buildDirectoryUrl,
                      )}`
                    }
                    const versionedSpecifier = `${baseUrl}${urlToRelativeUrl(
                      versionedUrl,
                      buildDirectoryUrl,
                    )}`
                    versionMappings[reference.specifier] = versionedSpecifier
                    versioningRedirections.set(reference.url, versionedUrl)
                    buildUrls[versionedSpecifier] = versionedUrl

                    const parentUrlInfo = finalGraph.getUrlInfo(
                      reference.parentUrl,
                    )
                    if (parentUrlInfo.jsQuote) {
                      // the url is inline inside js quotes
                      usedVersionMappings.push(reference.specifier)
                      return () =>
                        `${parentUrlInfo.jsQuote}+__v__(${JSON.stringify(
                          reference.specifier,
                        )})+${parentUrlInfo.jsQuote}`
                    }
                    if (
                      reference.type === "js_url_specifier" ||
                      reference.subtype === "import_dynamic"
                    ) {
                      usedVersionMappings.push(reference.specifier)
                      return () =>
                        `__v__(${JSON.stringify(reference.specifier)})`
                    }
                    return versionedSpecifier
                  },
                  fetchUrlContent: (versionedUrlInfo) => {
                    if (versionedUrlInfo.isInline) {
                      const rawUrlInfo = rawGraph.getUrlInfo(
                        buildToRawUrls[versionedUrlInfo.url],
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
              sourcemapsRelativeSources: true,
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
            if (usedVersionMappings.length) {
              const versionMappingsNeeded = {}
              usedVersionMappings.forEach((specifier) => {
                versionMappingsNeeded[specifier] = versionMappings[specifier]
              })
              await injectGlobalVersionMapping({
                finalGraphKitchen,
                finalGraph,
                versionMappings: versionMappingsNeeded,
              })
            }
          } catch (e) {
            versioningTask.fail()
            throw e
          }
          versioningTask.done()
        }
      }
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
            removeOriginalPositionAttributes: true,
          })
        }
        const version = urlInfo.data.version
        const useVersionedUrl =
          version && canUseVersionedUrl(urlInfo, finalGraph)
        const buildUrl = useVersionedUrl
          ? urlInfo.data.versionedUrl
          : urlInfo.url
        const buildUrlSpecifier = Object.keys(buildUrls).find(
          (key) => buildUrls[key] === buildUrl,
        )
        urlInfo.data.buildUrl = buildUrl
        urlInfo.data.buildUrlIsVersioned = useVersionedUrl
        urlInfo.data.buildUrlSpecifier = buildUrlSpecifier
      })
      cleanup_unused_urls: {
        const cleanupActions = []
        GRAPH.forEach(finalGraph, (urlInfo) => {
          // nothing uses this url anymore
          // - versioning update inline content
          // - file converted for import assertion or js_classic conversion
          if (
            !urlInfo.isEntryPoint &&
            urlInfo.type !== "sourcemap" &&
            urlInfo.dependents.size === 0 &&
            !urlInfo.injected // injected during postbuild
          ) {
            cleanupActions.push(() => {
              finalGraph.deleteUrlInfo(urlInfo.url)
            })
          }
        })
        cleanupActions.forEach((cleanupAction) => cleanupAction())
      }
      /*
       * Update <link rel="preload"> and friends after build (once we know everything)
       * - Used to remove resource hint targeting an url that is no longer used:
       *   - Happens because of import assertions transpilation (file is inlined into JS)
       */
      resync_ressource_hints: {
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
            visitHtmlNodes(htmlAst, {
              link: (node) => {
                const href = getHtmlNodeAttribute(node, "href")
                if (href === undefined || href.startsWith("data:")) {
                  return
                }
                const rel = getHtmlNodeAttribute(node, "rel")
                const isresourceHint = [
                  "preconnect",
                  "dns-prefetch",
                  "prefetch",
                  "preload",
                  "modulepreload",
                ].includes(rel)
                if (!isresourceHint) {
                  return
                }
                const buildUrl = buildUrls[href]
                const buildUrlInfo = (() => {
                  const finalUrl = finalRedirections.get(buildUrl)
                  if (finalUrl) {
                    const buildUrlInfo = finalGraph.getUrlInfo(finalUrl)
                    return buildUrlInfo
                  }
                  if (versioning) {
                    const buildUrlBeforeVersioning = getKeyForValue(
                      versioningRedirections,
                      buildUrl,
                    )
                    if (!buildUrlBeforeVersioning) {
                      return null
                    }
                    return finalGraph.getUrlInfo(buildUrlBeforeVersioning)
                  }
                  return finalGraph.getUrlInfo(buildUrl)
                })()
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
                  logger.info(
                    `remove resource hint because "${href}" not used anymore`,
                  )
                  mutations.push(() => {
                    removeHtmlNode(node)
                  })
                  return
                }
                if (rel === "preload" && buildUrlInfo.type === "js_classic") {
                  const buildUrlFormatted =
                    versioningRedirections.get(buildUrlInfo.url) ||
                    buildUrlInfo.url
                  const buildSpecifierBeforeRedirect = Object.keys(
                    buildUrls,
                  ).find((buildSpecifierCandidate) => {
                    const buildUrlCandidate = buildUrls[buildSpecifierCandidate]
                    return buildUrlCandidate === buildUrlFormatted
                  })
                  mutations.push(() => {
                    setHtmlNodeAttributes(node, {
                      href: buildSpecifierBeforeRedirect,
                      crossorigin: undefined,
                    })
                  })
                }
              },
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
      inject_urls_in_service_workers: {
        await injectServiceWorkerUrls({
          finalGraphKitchen,
          finalGraph,
          lineBreakNormalization,
        })
        buildOperation.throwIfAborted()
      }
    }

    const buildManifest = {}
    const buildFileContents = {}
    const buildInlineContents = {}
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
      const buildRelativeUrl = urlToRelativeUrl(
        urlInfo.data.buildUrl,
        buildDirectoryUrl,
      )
      if (urlInfo.isInline) {
        buildInlineContents[buildRelativeUrl] = urlInfo.content
      } else {
        buildFileContents[buildRelativeUrl] = urlInfo.content
        const buildUrlFormatted =
          finalRedirections.get(urlInfo.url) || urlInfo.url
        const buildRelativeUrlWithoutVersioning = urlToRelativeUrl(
          buildUrlFormatted,
          buildDirectoryUrl,
        )
        buildManifest[buildRelativeUrlWithoutVersioning] = buildRelativeUrl
      }
    })
    if (writeOnFileSystem) {
      if (buildDirectoryClean) {
        await ensureEmptyDirectory(buildDirectoryUrl)
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

const getKeyForValue = (map, value) => {
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

const canUseVersionedUrl = (urlInfo) => {
  if (urlInfo.isEntryPoint) {
    return false
  }
  if (urlInfo.type === "webmanifest") {
    return false
  }
  return true
}
