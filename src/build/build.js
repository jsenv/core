/*
 * Build is split in 3 steps:
 * 1. craft
 * 2. shape
 * 3. refine
 *
 * craft: prepare all the materials
 *  - resolve, fetch and transform all source files into "rawKitchen.graph"
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
} from "@jsenv/urls";
import {
  assertAndNormalizeDirectoryUrl,
  ensureEmptyDirectory,
  writeFileSync,
  comparePathnames,
} from "@jsenv/filesystem";
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort";
import {
  createLogger,
  createTaskLog,
  ANSI,
  createDetailedMessage,
} from "@jsenv/log";
import { createMagicSource, generateSourcemapFileUrl } from "@jsenv/sourcemap";
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
} from "@jsenv/ast";
import { RUNTIME_COMPAT } from "@jsenv/runtime-compat";
import { jsenvPluginJsModuleFallback } from "@jsenv/plugin-transpilation";

import { lookupPackageDirectory } from "../helpers/lookup_package_directory.js";
import { watchSourceFiles } from "../helpers/watch_source_files.js";
import { GRAPH_VISITOR } from "../kitchen/url_graph/url_graph_visitor.js";
import { createKitchen } from "../kitchen/kitchen.js";
import { createUrlGraphSummary } from "../kitchen/url_graph/url_graph_report.js";
import {
  isWebWorkerEntryPointReference,
  isWebWorkerUrlInfo,
} from "../kitchen/web_workers.js";
import { getCorePlugins } from "../plugins/plugins.js";
import { jsenvPluginReferenceAnalysis } from "../plugins/reference_analysis/jsenv_plugin_reference_analysis.js";
import { jsenvPluginInlining } from "../plugins/inlining/jsenv_plugin_inlining.js";
import { jsenvPluginLineBreakNormalization } from "./jsenv_plugin_line_break_normalization.js";

import { createBuildUrlsGenerator } from "./build_urls_generator.js";
import {
  injectVersionMappingsAsGlobal,
  injectVersionMappingsAsImportmap,
} from "./version_mappings_injection.js";
import { createVersionGenerator } from "./version_generator.js";

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
};

/**
 * Generate an optimized version of source files into a directory
 * @param {Object} buildParameters
 * @param {string|url} buildParameters.sourceDirectoryUrl
 *        Directory containing source files
 * @param {string|url} buildParameters.buildDirectoryUrl
 *        Directory where optimized files will be written
 * @param {object} buildParameters.entryPoints
 *        Object where keys are paths to source files and values are their future name in the build directory.
 *        Keys are relative to sourceDirectoryUrl
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
 * @param {('none'|'inline'|'file'|'programmatic'} [buildParameters.sourcemaps="none"]
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
  sourceDirectoryUrl,
  buildDirectoryUrl,
  entryPoints = {},
  assetsDirectory = "",
  ignore,

  runtimeCompat = defaultRuntimeCompat,
  base = runtimeCompat.node ? "./" : "/",
  plugins = [],
  referenceAnalysis = {},
  nodeEsmResolution,
  magicExtensions,
  magicDirectoryIndex,
  directoryReferenceAllowed,
  scenarioPlaceholders,
  transpilation = {},
  versioning = !runtimeCompat.node,
  versioningMethod = "search_param", // "filename", "search_param"
  versioningViaImportmap = true,
  lineBreakNormalization = process.platform === "win32",

  sourceFilesConfig = {},
  cooldownBetweenFileEvents,
  watch = false,

  directoryToClean,
  sourcemaps = "none",
  sourcemapsSourcesContent,
  writeOnFileSystem = true,
  outDirectoryUrl,
  assetManifest = versioningMethod === "filename",
  assetManifestFileRelativeUrl = "asset-manifest.json",
  ...rest
}) => {
  // param validation
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(
      sourceDirectoryUrl,
      "sourceDirectoryUrl",
    );
    buildDirectoryUrl = assertAndNormalizeDirectoryUrl(
      buildDirectoryUrl,
      "buildDirectoryUrl",
    );
    if (outDirectoryUrl === undefined) {
      if (!process.env.CI) {
        const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
        if (packageDirectoryUrl) {
          outDirectoryUrl = `${packageDirectoryUrl}.jsenv/`;
        }
      }
    } else if (outDirectoryUrl !== null && outDirectoryUrl !== false) {
      outDirectoryUrl = assertAndNormalizeDirectoryUrl(
        outDirectoryUrl,
        "outDirectoryUrl",
      );
    }

    if (typeof entryPoints !== "object" || entryPoints === null) {
      throw new TypeError(`entryPoints must be an object, got ${entryPoints}`);
    }
    const keys = Object.keys(entryPoints);
    keys.forEach((key) => {
      if (!key.startsWith("./")) {
        throw new TypeError(
          `entryPoints keys must start with "./", found ${key}`,
        );
      }
      const value = entryPoints[key];
      if (typeof value !== "string") {
        throw new TypeError(
          `entryPoints values must be strings, found "${value}" on key "${key}"`,
        );
      }
      if (value.includes("/")) {
        throw new TypeError(
          `entryPoints values must be plain strings (no "/"), found "${value}" on key "${key}"`,
        );
      }
    });
    if (!["filename", "search_param"].includes(versioningMethod)) {
      throw new TypeError(
        `versioningMethod must be "filename" or "search_param", got ${versioning}`,
      );
    }
  }

  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      );
    });
  }

  if (assetsDirectory && assetsDirectory[assetsDirectory.length - 1] !== "/") {
    assetsDirectory = `${assetsDirectory}/`;
  }
  if (directoryToClean === undefined) {
    if (assetsDirectory === undefined) {
      directoryToClean = buildDirectoryUrl;
    } else {
      directoryToClean = new URL(assetsDirectory, buildDirectoryUrl).href;
    }
  }

  const asFormattedBuildUrl = (generatedUrl, reference) => {
    if (base === "./") {
      const urlRelativeToParent = urlToRelativeUrl(
        generatedUrl,
        reference.ownerUrlInfo.url === sourceDirectoryUrl
          ? buildDirectoryUrl
          : reference.ownerUrlInfo.url,
      );
      if (urlRelativeToParent[0] !== ".") {
        // ensure "./" on relative url (otherwise it could be a "bare specifier")
        return `./${urlRelativeToParent}`;
      }
      return urlRelativeToParent;
    }
    const urlRelativeToBuildDirectory = urlToRelativeUrl(
      generatedUrl,
      buildDirectoryUrl,
    );
    return `${base}${urlRelativeToBuildDirectory}`;
  };

  const runBuild = async ({ signal, logLevel }) => {
    const logger = createLogger({ logLevel });
    const createBuildTask = (label) => {
      return createTaskLog(label, {
        disabled: !logger.levels.debug && !logger.levels.info,
        animated: !logger.levels.debug,
      });
    };

    const buildOperation = Abort.startOperation();
    buildOperation.addAbortSignal(signal);
    const entryPointKeys = Object.keys(entryPoints);
    if (entryPointKeys.length === 1) {
      logger.info(`
build "${entryPointKeys[0]}"`);
    } else {
      logger.info(`
build ${entryPointKeys.length} entry points`);
    }
    const explicitJsModuleFallback = entryPointKeys.some((key) =>
      entryPoints[key].includes("?js_module_fallback"),
    );
    const rawRedirections = new Map();
    const bundleRedirections = new Map();
    const bundleInternalRedirections = new Map();
    const finalRedirections = new Map();
    const versioningRedirections = new Map();
    const entryUrls = [];
    const contextSharedDuringBuild = {
      systemJsTranspilation: (() => {
        const nodeRuntimeEnabled = Object.keys(runtimeCompat).includes("node");
        if (nodeRuntimeEnabled) return false;
        if (!RUNTIME_COMPAT.isSupported(runtimeCompat, "script_type_module"))
          return true;
        if (!RUNTIME_COMPAT.isSupported(runtimeCompat, "import_dynamic"))
          return true;
        if (!RUNTIME_COMPAT.isSupported(runtimeCompat, "import_meta"))
          return true;
        if (
          versioning &&
          versioningViaImportmap &&
          !RUNTIME_COMPAT.isSupported(runtimeCompat, "importmap")
        )
          return true;
        return false;
      })(),
      minification: plugins.some(
        (plugin) => plugin.name === "jsenv:minification",
      ),
    };
    const rawKitchen = createKitchen({
      signal,
      logLevel,
      rootDirectoryUrl: sourceDirectoryUrl,
      ignore,
      // during first pass (craft) we keep "ignore:" when a reference is ignored
      // so that the second pass (shape) properly ignore those urls
      ignoreProtocol: "keep",
      build: true,
      runtimeCompat,
      ...contextSharedDuringBuild,
      plugins: [
        ...plugins,
        {
          appliesDuring: "build",
          fetchUrlContent: (urlInfo) => {
            if (urlInfo.firstReference.original) {
              rawRedirections.set(
                urlInfo.firstReference.original.url,
                urlInfo.firstReference.url,
              );
            }
          },
        },
        ...getCorePlugins({
          rootDirectoryUrl: sourceDirectoryUrl,
          runtimeCompat,
          referenceAnalysis,
          nodeEsmResolution,
          magicExtensions,
          magicDirectoryIndex,
          directoryReferenceAllowed,
          transpilation: {
            babelHelpersAsImport: !explicitJsModuleFallback,
            ...transpilation,
            jsModuleFallbackOnJsClassic: false,
          },

          inlining: false,
          scenarioPlaceholders,
        }),
      ],
      sourcemaps,
      sourcemapsSourcesContent,
      outDirectoryUrl: outDirectoryUrl
        ? new URL("build/", outDirectoryUrl)
        : undefined,
    });

    const buildUrlsGenerator = createBuildUrlsGenerator({
      buildDirectoryUrl,
      assetsDirectory,
    });
    const buildDirectoryRedirections = new Map();

    const associateBuildUrlAndRawUrl = (buildUrl, rawUrl, reason) => {
      if (urlIsInsideOf(rawUrl, buildDirectoryUrl)) {
        throw new Error(`raw url must be inside rawGraph, got ${rawUrl}`);
      }
      if (buildDirectoryRedirections.get(buildUrl) !== rawUrl) {
        logger.debug(`build url generated (${reason})
${ANSI.color(rawUrl, ANSI.GREY)} ->
${ANSI.color(buildUrl, ANSI.MAGENTA)}
`);
        buildDirectoryRedirections.set(buildUrl, rawUrl);
      }
    };
    const buildUrls = new Map();
    const bundleUrlInfos = {};
    const bundlers = {};
    let finalKitchen;
    let finalEntryUrls = [];

    craft: {
      const generateSourceGraph = createBuildTask("generate source graph");
      try {
        if (outDirectoryUrl) {
          await ensureEmptyDirectory(new URL(`build/`, outDirectoryUrl));
        }
        const rawRootUrlInfo = rawKitchen.graph.rootUrlInfo;
        await rawRootUrlInfo.dependencies.startCollecting(() => {
          Object.keys(entryPoints).forEach((key) => {
            const entryReference = rawRootUrlInfo.dependencies.found({
              trace: { message: `"${key}" in entryPoints parameter` },
              isEntryPoint: true,
              type: "entry_point",
              specifier: key,
              filename: entryPoints[key],
            });
            entryUrls.push(entryReference.url);
          });
        });
        await rawRootUrlInfo.cookDependencies({
          operation: buildOperation,
        });
      } catch (e) {
        generateSourceGraph.fail();
        throw e;
      }
      generateSourceGraph.done();
    }

    shape: {
      finalKitchen = createKitchen({
        name: "shape",
        logLevel,
        rootDirectoryUrl: buildDirectoryUrl,
        // here most plugins are not there
        // - no external plugin
        // - no plugin putting reference.mustIgnore on https urls
        // At this stage it's only about redirecting urls to the build directory
        // consequently only a subset or urls are supported
        supportedProtocols: ["file:", "data:", "virtual:", "ignore:"],
        ignore,
        ignoreProtocol: versioning ? "keep" : "remove",
        build: true,
        runtimeCompat,
        ...contextSharedDuringBuild,
        plugins: [
          jsenvPluginReferenceAnalysis({
            ...referenceAnalysis,
            fetchInlineUrls: false,
          }),
          ...(lineBreakNormalization
            ? [jsenvPluginLineBreakNormalization()]
            : []),
          jsenvPluginJsModuleFallback(),
          jsenvPluginInlining(),
          {
            name: "jsenv:build_shape",
            appliesDuring: "build",
            resolveReference: (reference) => {
              const getUrl = () => {
                if (reference.type === "filesystem") {
                  const ownerRawUrl = buildDirectoryRedirections.get(
                    reference.ownerUrlInfo.url,
                  );
                  const ownerUrl = ensurePathnameTrailingSlash(ownerRawUrl);
                  return new URL(reference.specifier, ownerUrl).href;
                }
                if (reference.specifier[0] === "/") {
                  return new URL(
                    reference.specifier.slice(1),
                    buildDirectoryUrl,
                  ).href;
                }
                return new URL(
                  reference.specifier,
                  reference.baseUrl || reference.ownerUrlInfo.url,
                ).href;
              };
              let url = getUrl();
              //  url = rawRedirections.get(url) || url
              url = bundleRedirections.get(url) || url;
              url = bundleInternalRedirections.get(url) || url;
              return url;
            },
            // redirecting references into the build directory
            redirectReference: (reference) => {
              if (!reference.url.startsWith("file:")) {
                return null;
              }
              // referenced by resource hint
              // -> keep it untouched, it will be handled by "resync_resource_hints"
              if (reference.isResourceHint) {
                return reference.original ? reference.original.url : null;
              }
              // already a build url
              const rawUrl = buildDirectoryRedirections.get(reference.url);
              if (rawUrl) {
                return reference.url;
              }
              if (reference.isInline) {
                const ownerFinalUrlInfo = finalKitchen.graph.getUrlInfo(
                  reference.ownerUrlInfo.url,
                );
                const ownerRawUrl = ownerFinalUrlInfo.originalUrl;
                const rawUrlInfo = GRAPH_VISITOR.find(
                  rawKitchen.graph,
                  (rawUrlInfo) => {
                    const { inlineUrlSite } = rawUrlInfo;
                    // not inline
                    if (!inlineUrlSite) return false;
                    if (
                      inlineUrlSite.url === ownerRawUrl &&
                      inlineUrlSite.line === reference.specifierLine &&
                      inlineUrlSite.column === reference.specifierColumn
                    ) {
                      return true;
                    }
                    if (rawUrlInfo.content === reference.content) {
                      return true;
                    }
                    if (rawUrlInfo.originalContent === reference.content) {
                      return true;
                    }
                    return false;
                  },
                );

                if (!rawUrlInfo) {
                  // generated during final graph
                  // (happens for JSON.parse injected for import assertions for instance)
                  // throw new Error(`cannot find raw url for "${reference.url}"`)
                  return reference.url;
                }
                const buildUrl = buildUrlsGenerator.generate(reference.url, {
                  urlInfo: rawUrlInfo,
                  ownerUrlInfo: ownerFinalUrlInfo,
                });
                associateBuildUrlAndRawUrl(
                  buildUrl,
                  rawUrlInfo.url,
                  "inline content",
                );
                return buildUrl;
              }
              // from "js_module_fallback":
              //   - injecting "?js_module_fallback" for the first time
              //   - injecting "?js_module_fallback" because the parentUrl has it
              if (reference.original) {
                const urlBeforeRedirect = reference.original.url;
                const urlAfterRedirect = reference.url;
                const isEntryPoint =
                  reference.isEntryPoint ||
                  isWebWorkerEntryPointReference(reference);
                // the url info do not exists yet (it will be created after this "redirectReference" hook)
                // And the content will be generated when url is cooked by url graph loader.
                // Here we just want to reserve an url for that file
                const urlInfo = {
                  data: reference.data,
                  isEntryPoint,
                  type: reference.expectedType,
                  subtype: reference.expectedSubtype,
                  filename: reference.filename,
                };
                if (urlIsInsideOf(urlBeforeRedirect, buildDirectoryUrl)) {
                  // the redirection happened on a build url, happens due to:
                  // 1. bundling
                  const buildUrl = buildUrlsGenerator.generate(
                    urlAfterRedirect,
                    {
                      urlInfo,
                    },
                  );
                  finalRedirections.set(urlBeforeRedirect, buildUrl);
                  return buildUrl;
                }
                const rawUrl = urlAfterRedirect;
                const buildUrl = buildUrlsGenerator.generate(rawUrl, {
                  urlInfo,
                });
                finalRedirections.set(urlBeforeRedirect, buildUrl);
                associateBuildUrlAndRawUrl(
                  buildUrl,
                  rawUrl,
                  "redirected during postbuild",
                );
                return buildUrl;
              }
              // from "js_module_fallback":
              // - to inject "s.js"
              if (reference.injected) {
                const buildUrl = buildUrlsGenerator.generate(reference.url, {
                  urlInfo: {
                    data: {},
                    type: "js_classic",
                  },
                });
                associateBuildUrlAndRawUrl(
                  buildUrl,
                  reference.url,
                  "injected during postbuild",
                );
                finalRedirections.set(buildUrl, buildUrl);
                return buildUrl;
              }
              const rawUrlInfo = rawKitchen.graph.getUrlInfo(reference.url);
              const ownerFinalUrlInfo = finalKitchen.graph.getUrlInfo(
                reference.ownerUrlInfo.url,
              );
              // files from root directory but not given to rollup nor postcss
              if (rawUrlInfo) {
                const referencedUrlObject = new URL(reference.url);
                referencedUrlObject.searchParams.delete("as_js_classic");
                referencedUrlObject.searchParams.delete("as_json_module");
                const buildUrl = buildUrlsGenerator.generate(
                  referencedUrlObject.href,
                  {
                    urlInfo: rawUrlInfo,
                    ownerUrlInfo: ownerFinalUrlInfo,
                  },
                );
                associateBuildUrlAndRawUrl(
                  buildUrl,
                  rawUrlInfo.url,
                  "raw file",
                );
                if (buildUrl.includes("?")) {
                  associateBuildUrlAndRawUrl(
                    asUrlWithoutSearch(buildUrl),
                    rawUrlInfo.url,
                    "raw file",
                  );
                }
                return buildUrl;
              }
              if (reference.type === "sourcemap_comment") {
                // inherit parent build url
                return generateSourcemapFileUrl(reference.ownerUrlInfo.url);
              }
              // files generated during the final graph:
              // - sourcemaps
              // const finalUrlInfo = finalGraph.getUrlInfo(url)
              const buildUrl = buildUrlsGenerator.generate(reference.url, {
                urlInfo: {
                  data: {},
                  type: "asset",
                },
              });
              return buildUrl;
            },
            formatReference: (reference) => {
              if (!reference.generatedUrl.startsWith("file:")) {
                return null;
              }
              if (reference.isWeak) {
                return null;
              }
              if (!urlIsInsideOf(reference.generatedUrl, buildDirectoryUrl)) {
                throw new Error(
                  `urls should be inside build directory at this stage, found "${reference.url}"`,
                );
              }
              const generatedUrlObject = new URL(reference.generatedUrl);
              generatedUrlObject.searchParams.delete("js_classic");
              generatedUrlObject.searchParams.delete("js_module");
              generatedUrlObject.searchParams.delete("js_module_fallback");
              generatedUrlObject.searchParams.delete("as_js_classic");
              generatedUrlObject.searchParams.delete("as_js_module");
              generatedUrlObject.searchParams.delete("as_json_module");
              generatedUrlObject.searchParams.delete("as_css_module");
              generatedUrlObject.searchParams.delete("as_text_module");
              generatedUrlObject.hash = "";
              const generatedUrl = generatedUrlObject.href;
              const specifier = asFormattedBuildUrl(generatedUrl, reference);
              buildUrls.set(specifier, reference.generatedUrl);
              return specifier;
            },
            fetchUrlContent: async (finalUrlInfo) => {
              const fromBundleOrRawGraph = (url) => {
                const bundleUrlInfo = bundleUrlInfos[url];
                if (bundleUrlInfo) {
                  return bundleUrlInfo;
                }
                const rawUrl = buildDirectoryRedirections.get(url) || url;
                const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
                if (!rawUrlInfo) {
                  throw new Error(
                    createDetailedMessage(`Cannot find url`, {
                      url,
                      "raw urls": Array.from(
                        buildDirectoryRedirections.values(),
                      ),
                      "build urls": Array.from(
                        buildDirectoryRedirections.keys(),
                      ),
                    }),
                  );
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
                  finalUrlInfo.type = rawUrlInfo.type;
                  finalUrlInfo.subtype = rawUrlInfo.subtype;
                  return rawUrlInfo;
                }
                return rawUrlInfo;
              };
              const { firstReference } = finalUrlInfo;
              // reference injected during "postbuild":
              // - happens for "js_module_fallback" injecting "s.js"
              if (firstReference.injected) {
                const originalRef = firstReference.original || firstReference;
                const rawReference =
                  rawKitchen.graph.rootUrlInfo.dependencies.inject({
                    type: originalRef.type,
                    expectedType: originalRef.expectedType,
                    specifier: originalRef.specifier,
                    specifierLine: originalRef.specifierLine,
                    specifierColumn: originalRef.specifierColumn,
                    specifierStart: originalRef.specifierStart,
                    specifierEnd: originalRef.specifierEnd,
                  });
                await rawReference.urlInfo.cook();
                return {
                  type: rawReference.urlInfo.type,
                  content: rawReference.urlInfo.content,
                  contentType: rawReference.urlInfo.contentType,
                  originalContent: rawReference.urlInfo.originalContent,
                  originalUrl: rawReference.urlInfo.originalUrl,
                  sourcemap: rawReference.urlInfo.sourcemap,
                };
              }
              if (firstReference.isInline) {
                const prevReference = firstReference.prev;
                if (prevReference) {
                  if (!prevReference.isInline) {
                    // the reference was inlined
                    const urlBeforeRedirect =
                      findKey(finalRedirections, prevReference.url) ||
                      prevReference.url;
                    return fromBundleOrRawGraph(urlBeforeRedirect);
                  }
                  if (buildDirectoryRedirections.has(prevReference.url)) {
                    // the prev reference is transformed to fetch underlying resource
                    // (getWithoutSearchParam)
                    return fromBundleOrRawGraph(prevReference.url);
                  }
                }
                return fromBundleOrRawGraph(firstReference.url);
              }
              if (firstReference.original) {
                // reference updated during "postbuild":
                // - happens for "js_module_fallback"
                return fromBundleOrRawGraph(firstReference.original.url);
              }
              return fromBundleOrRawGraph(finalUrlInfo.url);
            },
          },
          {
            name: "jsenv:optimize",
            appliesDuring: "build",
            transformUrlContent: async (urlInfo, context) => {
              await rawKitchen.pluginController.callAsyncHooks(
                "optimizeUrlContent",
                urlInfo,
                context,
                (optimizeReturnValue) => {
                  urlInfo.mutateContent(optimizeReturnValue);
                },
              );
            },
          },
        ],
        sourcemaps,
        sourcemapsSourcesContent,
        sourcemapsSourcesRelative: !versioning,
        outDirectoryUrl: outDirectoryUrl
          ? new URL("postbuild/", outDirectoryUrl)
          : undefined,
      });
      bundle: {
        rawKitchen.pluginController.plugins.forEach((plugin) => {
          const bundle = plugin.bundle;
          if (!bundle) {
            return;
          }
          if (typeof bundle !== "object") {
            throw new Error(
              `bundle must be an object, found "${bundle}" on plugin named "${plugin.name}"`,
            );
          }
          Object.keys(bundle).forEach((type) => {
            const bundleFunction = bundle[type];
            if (!bundleFunction) {
              return;
            }
            const bundlerForThatType = bundlers[type];
            if (bundlerForThatType) {
              // first plugin to define a bundle hook wins
              return;
            }
            bundlers[type] = {
              plugin,
              bundleFunction: bundle[type],
              urlInfos: [],
            };
          });
        });
        const addToBundlerIfAny = (rawUrlInfo) => {
          const bundler = bundlers[rawUrlInfo.type];
          if (bundler) {
            bundler.urlInfos.push(rawUrlInfo);
          }
        };
        GRAPH_VISITOR.forEach(rawKitchen.graph, (rawUrlInfo) => {
          // cleanup unused urls (avoid bundling things that are not actually used)
          // happens for:
          // - js import assertions
          // - conversion to js classic using ?as_js_classic or ?js_module_fallback
          if (!rawUrlInfo.isUsed()) {
            rawUrlInfo.deleteFromGraph();
            return;
          }
          if (rawUrlInfo.isEntryPoint) {
            addToBundlerIfAny(rawUrlInfo);
          }
          if (rawUrlInfo.type === "html") {
            rawUrlInfo.referenceToOthersSet.forEach((referenceToOther) => {
              const referencedUrlInfo = referenceToOther.urlInfo;
              if (referencedUrlInfo.isInline) {
                if (referencedUrlInfo.type === "js_module") {
                  // bundle inline script type module deps
                  referencedUrlInfo.referenceToOthersSet.forEach(
                    (jsModuleReferenceToOther) => {
                      if (jsModuleReferenceToOther.type === "js_import") {
                        const inlineUrlInfo = jsModuleReferenceToOther.urlInfo;
                        addToBundlerIfAny(inlineUrlInfo);
                      }
                    },
                  );
                }
                // inline content cannot be bundled
                return;
              }
              addToBundlerIfAny(referencedUrlInfo);
            });
            rawUrlInfo.referenceToOthersSet.forEach((referenceToOther) => {
              if (
                referenceToOther.isResourceHint &&
                referenceToOther.expectedType === "js_module"
              ) {
                const referencedUrlInfo = referenceToOther.urlInfo;
                if (
                  referencedUrlInfo &&
                  // something else than the resource hint is using this url
                  referencedUrlInfo.referenceFromOthersSet.size > 0
                ) {
                  addToBundlerIfAny(referencedUrlInfo);
                }
              }
            });
            return;
          }
          // File referenced with new URL('./file.js', import.meta.url)
          // are entry points that should be bundled
          // For instance we will bundle service worker/workers detected like this
          if (rawUrlInfo.type === "js_module") {
            rawUrlInfo.referenceToOthersSet.forEach((referenceToOther) => {
              if (referenceToOther.type !== "js_url") {
                return;
              }
              const referencedUrlInfo = referenceToOther.urlInfo;
              const bundler = bundlers[referencedUrlInfo.type];
              if (!bundler) {
                return;
              }

              let willAlreadyBeBundled = true;
              for (const referenceFromOther of referencedUrlInfo.referenceFromOthersSet) {
                if (referenceFromOther.url === referencedUrlInfo.url) {
                  willAlreadyBeBundled =
                    referenceFromOther.subtype === "import_dynamic" ||
                    referenceFromOther.type === "script";
                }
              }
              if (!willAlreadyBeBundled) {
                bundler.urlInfos.push(referencedUrlInfo);
              }
            });
          }
        });
        await Object.keys(bundlers).reduce(async (previous, type) => {
          await previous;
          const bundler = bundlers[type];
          const urlInfosToBundle = bundler.urlInfos;
          if (urlInfosToBundle.length === 0) {
            return;
          }
          const bundleTask = createBuildTask(`bundle "${type}"`);
          try {
            const bundlerGeneratedUrlInfos =
              await rawKitchen.pluginController.callAsyncHook(
                {
                  plugin: bundler.plugin,
                  hookName: "bundle",
                  value: bundler.bundleFunction,
                },
                urlInfosToBundle,
                {
                  ...rawKitchen.context,
                  buildDirectoryUrl,
                  assetsDirectory,
                },
              );
            Object.keys(bundlerGeneratedUrlInfos).forEach((url) => {
              const rawUrlInfo = rawKitchen.graph.getUrlInfo(url);
              const bundlerGeneratedUrlInfo = bundlerGeneratedUrlInfos[url];
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
              };
              if (bundlerGeneratedUrlInfo.sourceUrls) {
                bundlerGeneratedUrlInfo.sourceUrls.forEach((sourceUrl) => {
                  const sourceRawUrlInfo =
                    rawKitchen.graph.getUrlInfo(sourceUrl);
                  if (sourceRawUrlInfo) {
                    sourceRawUrlInfo.data.bundled = true;
                  }
                });
              }
              const buildUrl = buildUrlsGenerator.generate(url, {
                urlInfo: bundleUrlInfo,
              });
              bundleRedirections.set(url, buildUrl);
              if (urlIsInsideOf(url, buildDirectoryUrl)) {
                if (bundlerGeneratedUrlInfo.data.isDynamicEntry) {
                  const rawUrlInfo = rawKitchen.graph.getUrlInfo(
                    bundlerGeneratedUrlInfo.originalUrl,
                  );
                  rawUrlInfo.data.bundled = false;
                  bundleRedirections.set(
                    bundlerGeneratedUrlInfo.originalUrl,
                    buildUrl,
                  );
                  associateBuildUrlAndRawUrl(
                    buildUrl,
                    bundlerGeneratedUrlInfo.originalUrl,
                    "bundle",
                  );
                } else {
                  bundleUrlInfo.data.generatedToShareCode = true;
                }
              } else {
                associateBuildUrlAndRawUrl(buildUrl, url, "bundle");
              }
              bundleUrlInfos[buildUrl] = bundleUrlInfo;
              if (buildUrl.includes("?")) {
                bundleUrlInfos[asUrlWithoutSearch(buildUrl)] = bundleUrlInfo;
              }
              if (bundlerGeneratedUrlInfo.data.bundleRelativeUrl) {
                const urlForBundler = new URL(
                  bundlerGeneratedUrlInfo.data.bundleRelativeUrl,
                  buildDirectoryUrl,
                ).href;
                if (urlForBundler !== buildUrl) {
                  bundleInternalRedirections.set(urlForBundler, buildUrl);
                }
              }
            });
          } catch (e) {
            bundleTask.fail();
            throw e;
          }
          bundleTask.done();
        }, Promise.resolve());
      }
      reload_in_build_directory: {
        const generateBuildGraph = createBuildTask("generate build graph");
        try {
          if (outDirectoryUrl) {
            await ensureEmptyDirectory(new URL(`postbuild/`, outDirectoryUrl));
          }
          const finalRootUrlInfo = finalKitchen.graph.rootUrlInfo;
          await finalRootUrlInfo.dependencies.startCollecting(() => {
            entryUrls.forEach((entryUrl) => {
              const entryReference = finalRootUrlInfo.dependencies.found({
                trace: { message: `entryPoint` },
                isEntryPoint: true,
                type: "entry_point",
                specifier: entryUrl,
              });
              finalEntryUrls.push(entryReference.url);
            });
          });
          await finalRootUrlInfo.cookDependencies({
            operation: buildOperation,
          });
        } catch (e) {
          generateBuildGraph.fail();
          throw e;
        }
        generateBuildGraph.done();
      }
    }

    const versionMap = new Map();
    const versionedUrlMap = new Map();
    refine: {
      inject_version_in_urls: {
        if (!versioning) {
          break inject_version_in_urls;
        }
        const versioningTask = createBuildTask("inject version in urls");
        try {
          const canUseImportmap =
            versioningViaImportmap &&
            finalEntryUrls.every((finalEntryUrl) => {
              const finalEntryUrlInfo =
                finalKitchen.graph.getUrlInfo(finalEntryUrl);
              return finalEntryUrlInfo.type === "html";
            }) &&
            finalKitchen.context.isSupportedOnCurrentClients("importmap");
          const workerReferenceSet = new Set();
          const isReferencedByWorker = (reference, graph) => {
            if (workerReferenceSet.has(reference)) {
              return true;
            }
            const urlInfo = graph.getUrlInfo(reference.url);
            const dependentWorker = GRAPH_VISITOR.findDependent(
              graph,
              urlInfo,
              (dependentUrlInfo) => {
                return isWebWorkerUrlInfo(dependentUrlInfo);
              },
            );
            if (dependentWorker) {
              workerReferenceSet.add(reference);
              return true;
            }
            return Boolean(dependentWorker);
          };
          const preferWithoutVersioning = (reference) => {
            const ownerFinalUrlInfo = finalKitchen.graph.getUrlInfo(
              reference.ownerUrlInfo.url,
            );
            if (ownerFinalUrlInfo.jsQuote) {
              return {
                type: "global",
                source: `${ownerFinalUrlInfo.jsQuote}+__v__(${JSON.stringify(
                  reference.specifier,
                )})+${ownerFinalUrlInfo.jsQuote}`,
              };
            }
            if (reference.type === "js_url") {
              return {
                type: "global",
                source: `__v__(${JSON.stringify(reference.specifier)})`,
              };
            }
            if (reference.type === "js_import") {
              if (reference.subtype === "import_dynamic") {
                return {
                  type: "global",
                  source: `__v__(${JSON.stringify(reference.specifier)})`,
                };
              }
              if (reference.subtype === "import_meta_resolve") {
                return {
                  type: "global",
                  source: `__v__(${JSON.stringify(reference.specifier)})`,
                };
              }
              if (
                canUseImportmap &&
                !isReferencedByWorker(reference, finalKitchen.graph)
              ) {
                return {
                  type: "importmap",
                  source: JSON.stringify(reference.specifier),
                };
              }
            }
            return null;
          };

          // see also https://github.com/rollup/rollup/pull/4543
          const contentVersionMap = new Map();
          const hashCallbacks = [];
          GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
            if (urlInfo.type === "sourcemap") {
              return;
            }
            // ignore:
            // - inline files and data files:
            //   they are already taken into account in the file where they appear
            // - ignored files:
            //   we don't know their content
            // - unused files without reference
            //   File updated such as style.css -> style.css.js or file.js->file.nomodule.js
            //   Are used at some point just to be discarded later because they need to be converted
            //   There is no need to version them and we could not because the file have been ignored
            //   so their content is unknown
            if (urlInfo.isInline) {
              return;
            }
            // urlInfo became inline and is not referenced by something else
            if (urlInfo.url.startsWith("data:")) {
              return;
            }
            if (urlInfo.url.startsWith("ignore:")) {
              return;
            }
            if (!urlInfo.isUsed()) {
              return;
            }
            const urlContent =
              urlInfo.type === "html"
                ? stringifyHtmlAst(
                    parseHtmlString(urlInfo.content, {
                      storeOriginalPositions: false,
                    }),
                    {
                      cleanupJsenvAttributes: true,
                      cleanupPositionAttributes: true,
                    },
                  )
                : urlInfo.content;
            const contentVersionGenerator = createVersionGenerator();
            contentVersionGenerator.augmentWithContent(urlContent);
            const contentVersion = contentVersionGenerator.generate();
            contentVersionMap.set(urlInfo.url, contentVersion);
            const versionMutations = [];
            const seen = new Set();
            const visitDependencies = (urlInfo) => {
              urlInfo.referenceToOthersSet.forEach((referenceToOther) => {
                if (seen.has(referenceToOther)) return;
                seen.add(referenceToOther);
                const referencedUrlInfo = finalKitchen.graph.getUrlInfo(
                  referenceToOther.url,
                );
                versionMutations.push(() => {
                  const referencedContentVersion = contentVersionMap.get(
                    referenceToOther.url,
                  );
                  if (!referencedContentVersion) {
                    // no content generated for this dependency
                    // (inline, data:, ignore:, sourcemap, ...)
                    return null;
                  }
                  if (preferWithoutVersioning(referenceToOther)) {
                    // when versioning is dynamic no need to take into account
                    // happens for:
                    // - specifier mapped by window.__v__()
                    // - specifier mapped by importmap
                    return null;
                  }
                  return referencedContentVersion;
                });
                visitDependencies(referencedUrlInfo);
              });
            };
            visitDependencies(urlInfo);

            hashCallbacks.push(() => {
              let version;
              if (versionMutations.length === 0) {
                version = contentVersion;
              } else {
                const versionGenerator = createVersionGenerator();
                versionGenerator.augment(contentVersion);
                versionMutations.forEach((versionMutation) => {
                  const value = versionMutation();
                  if (value) {
                    versionGenerator.augment(value);
                  }
                });
                version = versionGenerator.generate();
              }
              versionMap.set(urlInfo.url, version);
              const buildUrlObject = new URL(urlInfo.url);
              // remove ?js_module_fallback
              // this information is already hold into ".nomodule"
              buildUrlObject.searchParams.delete("js_module_fallback");
              buildUrlObject.searchParams.delete("as_js_classic");
              buildUrlObject.searchParams.delete("as_js_module");
              buildUrlObject.searchParams.delete("as_json_module");
              buildUrlObject.searchParams.delete("as_css_module");
              buildUrlObject.searchParams.delete("as_text_module");
              const buildUrl = buildUrlObject.href;
              finalRedirections.set(urlInfo.url, buildUrl);
              versionedUrlMap.set(
                urlInfo.url,
                normalizeUrl(
                  injectVersionIntoBuildUrl({
                    buildUrl,
                    version,
                    versioningMethod,
                  }),
                ),
              );
            });
          });
          hashCallbacks.forEach((callback) => {
            callback();
          });

          const versionMappings = {};
          const versionMappingsOnGlobalMap = new Set();
          const versionMappingsOnImportmap = new Set();
          const versioningKitchen = createKitchen({
            name: "versioning",
            logLevel: logger.level,
            rootDirectoryUrl: buildDirectoryUrl,
            ignore,
            ignoreProtocol: "remove",
            graph: finalKitchen.graph,
            build: true,
            versioning: true,
            runtimeCompat,
            ...contextSharedDuringBuild,
            plugins: [
              jsenvPluginReferenceAnalysis({
                ...referenceAnalysis,
                fetchInlineUrls: false,
                inlineConvertedScript: true, // to be able to version their urls
                allowEscapeForVersioning: true,
              }),
              {
                name: "jsenv:versioning",
                appliesDuring: "build",
                resolveReference: (reference) => {
                  const buildUrl = buildUrls.get(reference.specifier);
                  if (buildUrl) {
                    return buildUrl;
                  }
                  let urlObject;
                  if (reference.specifier[0] === "/") {
                    urlObject = new URL(
                      reference.specifier.slice(1),
                      buildDirectoryUrl,
                    );
                  } else {
                    urlObject = new URL(
                      reference.specifier,
                      reference.baseUrl || reference.ownerUrlInfo.url,
                    );
                  }
                  const url = urlObject.href;
                  // during versioning we revisit the deps
                  // but the code used to enforce trailing slash on directories
                  // is not applied because "jsenv:file_url_resolution" is not used
                  // so here we search if the url with a trailing slash exists
                  if (
                    reference.type === "filesystem" &&
                    !urlObject.pathname.endsWith("/")
                  ) {
                    const urlWithTrailingSlash = `${url}/`;
                    const specifier = findKey(buildUrls, urlWithTrailingSlash);
                    if (specifier) {
                      return urlWithTrailingSlash;
                    }
                  }
                  return url;
                },
                formatReference: (reference) => {
                  if (reference.url.startsWith("ignore:")) {
                    return null;
                  }
                  if (reference.isInline) {
                    return null;
                  }
                  if (reference.url.startsWith("data:")) {
                    return null;
                  }
                  if (reference.isWeak) {
                    return null;
                  }
                  // specifier comes from "normalize" hook done a bit earlier in this file
                  // we want to get back their build url to access their infos
                  const referencedUrlInfo = finalKitchen.graph.getUrlInfo(
                    reference.url,
                  );
                  if (!canUseVersionedUrl(referencedUrlInfo)) {
                    return reference.specifier;
                  }
                  const versionedUrl = versionedUrlMap.get(reference.url);
                  if (!versionedUrl) {
                    // happens for inline content and sourcemaps
                    return urlToRelativeUrl(
                      referencedUrlInfo.url,
                      reference.ownerUrlInfo.url,
                    );
                  }
                  const versionedSpecifier = asFormattedBuildUrl(
                    versionedUrl,
                    reference,
                  );
                  versionMappings[reference.specifier] = versionedSpecifier;
                  versioningRedirections.set(reference.url, versionedUrl);
                  buildUrls.set(versionedSpecifier, versionedUrl);

                  const withoutVersioning = preferWithoutVersioning(reference);
                  if (withoutVersioning) {
                    if (withoutVersioning.type === "importmap") {
                      versionMappingsOnImportmap.add(reference.specifier);
                    } else {
                      versionMappingsOnGlobalMap.add(reference.specifier);
                    }
                    return () => withoutVersioning.source;
                  }
                  return versionedSpecifier;
                },
                fetchUrlContent: (versionedUrlInfo) => {
                  if (versionedUrlInfo.isInline) {
                    const versionedUrl = versionedUrlInfo.url;
                    const rawUrl = buildDirectoryRedirections.get(versionedUrl);
                    const rawUrlInfo = rawKitchen.graph.getUrlInfo(rawUrl);
                    const finalUrlInfo =
                      finalKitchen.graph.getUrlInfo(versionedUrl);
                    return {
                      content: versionedUrlInfo.content,
                      contentType: versionedUrlInfo.contentType,
                      originalContent: rawUrlInfo
                        ? rawUrlInfo.originalContent
                        : undefined,
                      sourcemap: finalUrlInfo
                        ? finalUrlInfo.sourcemap
                        : undefined,
                    };
                  }
                  return versionedUrlInfo;
                },
              },
            ],
            sourcemaps,
            sourcemapsSourcesContent,
            sourcemapsSourcesRelative: true,
            outDirectoryUrl: outDirectoryUrl
              ? new URL("postbuild/", outDirectoryUrl)
              : undefined,
          });
          finalKitchen.context = versioningKitchen.context;

          const versioningRootUrlInfo = versioningKitchen.graph.rootUrlInfo;
          await versioningRootUrlInfo.dependencies.startCollecting(() => {
            finalEntryUrls.forEach((finalEntryUrl) => {
              versioningRootUrlInfo.dependencies.found({
                trace: { message: `entryPoint` },
                parentUrl: buildDirectoryUrl,
                type: "entry_point",
                specifier: finalEntryUrl,
              });
            });
          });
          await versioningRootUrlInfo.cookDependencies({
            operation: buildOperation,
          });
          workerReferenceSet.clear();
          const actions = [];
          const visitors = [];
          if (versionMappingsOnImportmap.size) {
            const versionMappingsNeeded = {};
            versionMappingsOnImportmap.forEach((specifier) => {
              versionMappingsNeeded[specifier] = versionMappings[specifier];
            });
            visitors.push((urlInfo) => {
              if (urlInfo.type === "html" && urlInfo.isEntryPoint) {
                actions.push(async () => {
                  await injectVersionMappingsAsImportmap({
                    kitchen: finalKitchen,
                    urlInfo,
                    versionMappings: versionMappingsNeeded,
                  });
                });
              }
            });
          }
          if (versionMappingsOnGlobalMap.size) {
            const versionMappingsNeeded = {};
            versionMappingsOnGlobalMap.forEach((specifier) => {
              versionMappingsNeeded[specifier] = versionMappings[specifier];
            });
            visitors.push((urlInfo) => {
              if (urlInfo.isEntryPoint) {
                actions.push(async () => {
                  await injectVersionMappingsAsGlobal({
                    kitchen: finalKitchen,
                    urlInfo,
                    versionMappings: versionMappingsNeeded,
                  });
                });
              }
            });
          }
          if (visitors.length) {
            GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
              visitors.forEach((visitor) => visitor(urlInfo));
            });
            if (actions.length) {
              await Promise.all(actions.map((action) => action()));
            }
          }
        } catch (e) {
          versioningTask.fail();
          throw e;
        }
        versioningTask.done();
      }
      cleanup_jsenv_attributes_from_html: {
        GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
          if (!urlInfo.url.startsWith("file:")) {
            return;
          }
          if (urlInfo.type === "html") {
            const htmlAst = parseHtmlString(urlInfo.content, {
              storeOriginalPositions: false,
            });
            urlInfo.content = stringifyHtmlAst(htmlAst, {
              cleanupJsenvAttributes: true,
              cleanupPositionAttributes: true,
            });
          }
        });
      }
      /*
       * Update <link rel="preload"> and friends after build (once we know everything)
       * - Used to remove resource hint targeting an url that is no longer used:
       *   - because of bundlings
       *   - because of import assertions transpilation (file is inlined into JS)
       */
      resync_resource_hints: {
        const actions = [];
        GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
          if (urlInfo.type !== "html") {
            return;
          }
          const htmlAst = parseHtmlString(urlInfo.content, {
            storeOriginalPositions: false,
          });
          const mutations = [];
          const hintsToInject = {};
          visitHtmlNodes(htmlAst, {
            link: (node) => {
              const href = getHtmlNodeAttribute(node, "href");
              if (href === undefined || href.startsWith("data:")) {
                return;
              }
              const rel = getHtmlNodeAttribute(node, "rel");
              const isResourceHint = [
                "preconnect",
                "dns-prefetch",
                "prefetch",
                "preload",
                "modulepreload",
              ].includes(rel);
              if (!isResourceHint) {
                return;
              }
              const onBuildUrl = (buildUrl) => {
                const buildUrlInfo = buildUrl
                  ? finalKitchen.graph.getUrlInfo(buildUrl)
                  : null;
                if (!buildUrlInfo) {
                  logger.warn(
                    `remove resource hint because cannot find "${href}" in the graph`,
                  );
                  mutations.push(() => {
                    removeHtmlNode(node);
                  });
                  return;
                }
                if (buildUrlInfo.referenceFromOthersSet.size === 0) {
                  logger.warn(
                    `remove resource hint because "${href}" not used anymore`,
                  );
                  mutations.push(() => {
                    removeHtmlNode(node);
                  });
                  return;
                }
                const buildUrlFormatted =
                  versioningRedirections.get(buildUrlInfo.url) ||
                  buildUrlInfo.url;
                const buildSpecifierBeforeRedirect = findKey(
                  buildUrls,
                  buildUrlFormatted,
                );
                mutations.push(() => {
                  setHtmlNodeAttributes(node, {
                    href: buildSpecifierBeforeRedirect,
                    ...(buildUrlInfo.type === "js_classic"
                      ? { crossorigin: undefined }
                      : {}),
                  });
                });
                for (const referenceToOther of buildUrlInfo.referenceToOthersSet) {
                  const referencedUrlInfo = finalKitchen.graph.urlInfoMap.get(
                    referenceToOther.url,
                  );
                  if (referencedUrlInfo.data.generatedToShareCode) {
                    hintsToInject[referencedUrlInfo.url] = node;
                  }
                }
              };
              if (href.startsWith("file:")) {
                let url = href;
                url = rawRedirections.get(url) || url;
                const rawUrlInfo = rawKitchen.graph.getUrlInfo(url);
                if (rawUrlInfo && rawUrlInfo.data.bundled) {
                  logger.warn(
                    `remove resource hint on "${href}" because it was bundled`,
                  );
                  mutations.push(() => {
                    removeHtmlNode(node);
                  });
                } else {
                  url = bundleRedirections.get(url) || url;
                  url = bundleInternalRedirections.get(url) || url;
                  url = finalRedirections.get(url) || url;
                  url = findKey(buildDirectoryRedirections, url) || url;
                  onBuildUrl(url);
                }
              } else {
                onBuildUrl(null);
              }
            },
          });
          Object.keys(hintsToInject).forEach((urlToHint) => {
            const hintNode = hintsToInject[urlToHint];
            const urlFormatted =
              versioningRedirections.get(urlToHint) || urlToHint;
            const specifierBeforeRedirect = findKey(buildUrls, urlFormatted);
            const found = findHtmlNode(htmlAst, (htmlNode) => {
              return (
                htmlNode.nodeName === "link" &&
                getHtmlNodeAttribute(htmlNode, "href") ===
                  specifierBeforeRedirect
              );
            });
            if (!found) {
              mutations.push(() => {
                const nodeToInsert = createHtmlNode({
                  tagName: "link",
                  href: specifierBeforeRedirect,
                  rel: getHtmlNodeAttribute(hintNode, "rel"),
                  as: getHtmlNodeAttribute(hintNode, "as"),
                  type: getHtmlNodeAttribute(hintNode, "type"),
                  crossorigin: getHtmlNodeAttribute(hintNode, "crossorigin"),
                });
                insertHtmlNodeAfter(nodeToInsert, hintNode);
              });
            }
          });
          if (mutations.length > 0) {
            actions.push(() => {
              mutations.forEach((mutation) => mutation());
              urlInfo.mutateContent({
                content: stringifyHtmlAst(htmlAst),
              });
            });
          }
        });
        if (actions.length > 0) {
          const resyncTask = createBuildTask("resync resource hints");
          actions.map((resourceHintAction) => resourceHintAction());
          buildOperation.throwIfAborted();
          resyncTask.done();
        }
      }
      delete_unused_urls: {
        const actions = [];
        GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
          if (!urlInfo.isUsed()) {
            actions.push(() => {
              urlInfo.deleteFromGraph();
            });
          }
        });
        actions.forEach((action) => action());
      }
      inject_urls_in_service_workers: {
        const serviceWorkerEntryUrlInfos = GRAPH_VISITOR.filter(
          finalKitchen.graph,
          (finalUrlInfo) => {
            return (
              finalUrlInfo.subtype === "service_worker" &&
              finalUrlInfo.isEntryPoint
            );
          },
        );
        if (serviceWorkerEntryUrlInfos.length > 0) {
          const urlsInjectionInSw = createBuildTask(
            "inject urls in service worker",
          );
          const serviceWorkerResources = {};
          GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
            if (!urlInfo.url.startsWith("file:")) {
              return;
            }
            if (urlInfo.isInline) {
              return;
            }
            if (!canUseVersionedUrl(urlInfo)) {
              // when url is not versioned we compute a "version" for that url anyway
              // so that service worker source still changes and navigator
              // detect there is a change
              const specifier = findKey(buildUrls, urlInfo.url);
              serviceWorkerResources[specifier] = {
                version: versionMap.get(urlInfo.url),
              };
              return;
            }
            const specifier = findKey(buildUrls, urlInfo.url);
            const versionedUrl = versionedUrlMap.get(urlInfo.url);
            const versionedSpecifier = findKey(buildUrls, versionedUrl);
            serviceWorkerResources[specifier] = {
              version: versionMap.get(urlInfo.url),
              versionedUrl: versionedSpecifier,
            };
          });
          serviceWorkerEntryUrlInfos.forEach((serviceWorkerEntryUrlInfo) => {
            const magicSource = createMagicSource(
              serviceWorkerEntryUrlInfo.content,
            );
            const serviceWorkerResourcesWithoutSwScriptItSelf = {
              ...serviceWorkerResources,
            };
            const serviceWorkerSpecifier = findKey(
              buildUrls,
              serviceWorkerEntryUrlInfo.url,
            );
            delete serviceWorkerResourcesWithoutSwScriptItSelf[
              serviceWorkerSpecifier
            ];
            magicSource.prepend(
              `\nself.resourcesFromJsenvBuild = ${JSON.stringify(
                serviceWorkerResourcesWithoutSwScriptItSelf,
                null,
                "  ",
              )};\n`,
            );
            const { content, sourcemap } = magicSource.toContentAndSourcemap();
            serviceWorkerEntryUrlInfo.mutateContent({
              content,
              sourcemap,
            });
          });
          urlsInjectionInSw.done();
        }
        buildOperation.throwIfAborted();
      }
    }

    const buildManifest = {};
    const buildContents = {};
    const buildInlineRelativeUrls = [];
    const getBuildRelativeUrl = (url) => {
      const urlObject = new URL(url);
      urlObject.searchParams.delete("js_module_fallback");
      urlObject.searchParams.delete("as_css_module");
      urlObject.searchParams.delete("as_json_module");
      urlObject.searchParams.delete("as_text_module");
      url = urlObject.href;
      const buildRelativeUrl = urlToRelativeUrl(url, buildDirectoryUrl);
      return buildRelativeUrl;
    };
    GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
      if (!urlInfo.url.startsWith("file:")) {
        return;
      }
      if (urlInfo.type === "directory") {
        return;
      }
      if (urlInfo.isInline) {
        const buildRelativeUrl = getBuildRelativeUrl(urlInfo.url);
        buildContents[buildRelativeUrl] = urlInfo.content;
        buildInlineRelativeUrls.push(buildRelativeUrl);
      } else {
        const versionedUrl = versionedUrlMap.get(urlInfo.url);
        if (versionedUrl && canUseVersionedUrl(urlInfo)) {
          const buildRelativeUrl = getBuildRelativeUrl(urlInfo.url);
          const versionedBuildRelativeUrl = getBuildRelativeUrl(versionedUrl);
          if (versioningMethod === "search_param") {
            buildContents[buildRelativeUrl] = urlInfo.content;
          } else {
            buildContents[versionedBuildRelativeUrl] = urlInfo.content;
          }
          buildManifest[buildRelativeUrl] = versionedBuildRelativeUrl;
        } else {
          const buildRelativeUrl = getBuildRelativeUrl(urlInfo.url);
          buildContents[buildRelativeUrl] = urlInfo.content;
        }
      }
    });
    const buildFileContents = {};
    const buildInlineContents = {};
    Object.keys(buildContents)
      .sort((a, b) => comparePathnames(a, b))
      .forEach((buildRelativeUrl) => {
        if (buildInlineRelativeUrls.includes(buildRelativeUrl)) {
          buildInlineContents[buildRelativeUrl] =
            buildContents[buildRelativeUrl];
        } else {
          buildFileContents[buildRelativeUrl] = buildContents[buildRelativeUrl];
        }
      });

    if (writeOnFileSystem) {
      const writingFiles = createBuildTask("write files in build directory");
      if (directoryToClean) {
        await ensureEmptyDirectory(directoryToClean);
      }
      const buildRelativeUrls = Object.keys(buildFileContents);
      buildRelativeUrls.forEach((buildRelativeUrl) => {
        writeFileSync(
          new URL(buildRelativeUrl, buildDirectoryUrl),
          buildFileContents[buildRelativeUrl],
        );
      });
      if (versioning && assetManifest && Object.keys(buildManifest).length) {
        writeFileSync(
          new URL(assetManifestFileRelativeUrl, buildDirectoryUrl),
          JSON.stringify(buildManifest, null, "  "),
        );
      }
      writingFiles.done();
    }
    logger.info(
      createUrlGraphSummary(finalKitchen.graph, { title: "build files" }),
    );
    return {
      buildFileContents,
      buildInlineContents,
      buildManifest,
    };
  };

  if (!watch) {
    return runBuild({ signal: operation.signal, logLevel });
  }

  let resolveFirstBuild;
  let rejectFirstBuild;
  const firstBuildPromise = new Promise((resolve, reject) => {
    resolveFirstBuild = resolve;
    rejectFirstBuild = reject;
  });
  let buildAbortController;
  let watchFilesTask;
  const startBuild = async () => {
    const buildTask = createTaskLog("build");
    buildAbortController = new AbortController();
    try {
      const result = await runBuild({
        signal: buildAbortController.signal,
        logLevel: "warn",
      });
      buildTask.done();
      resolveFirstBuild(result);
      watchFilesTask = createTaskLog("watch files");
    } catch (e) {
      if (Abort.isAbortError(e)) {
        buildTask.fail(`build aborted`);
      } else if (e.code === "PARSE_ERROR") {
        buildTask.fail();
        console.error(e.stack);
        watchFilesTask = createTaskLog("watch files");
      } else {
        buildTask.fail();
        rejectFirstBuild(e);
        throw e;
      }
    }
  };

  startBuild();
  let startTimeout;
  const stopWatchingSourceFiles = watchSourceFiles(
    sourceDirectoryUrl,
    ({ url, event }) => {
      if (watchFilesTask) {
        watchFilesTask.happen(
          `${url.slice(sourceDirectoryUrl.length)} ${event}`,
        );
        watchFilesTask = null;
      }
      buildAbortController.abort();
      // setTimeout is to ensure the abortController.abort() above
      // is properly taken into account so that logs about abort comes first
      // then logs about re-running the build happens
      clearTimeout(startTimeout);
      startTimeout = setTimeout(startBuild, 20);
    },
    {
      sourceFilesConfig,
      keepProcessAlive: true,
      cooldownBetweenFileEvents,
    },
  );
  operation.addAbortCallback(() => {
    stopWatchingSourceFiles();
  });
  await firstBuildPromise;
  return stopWatchingSourceFiles;
};

const findKey = (map, value) => {
  for (const [keyCandidate, valueCandidate] of map) {
    if (valueCandidate === value) {
      return keyCandidate;
    }
  }
  return undefined;
};

const injectVersionIntoBuildUrl = ({ buildUrl, version, versioningMethod }) => {
  if (versioningMethod === "search_param") {
    return injectQueryParams(buildUrl, {
      v: version,
    });
  }
  const basename = urlToBasename(buildUrl);
  const extension = urlToExtension(buildUrl);
  const versionedFilename = `${basename}-${version}${extension}`;
  const versionedUrl = setUrlFilename(buildUrl, versionedFilename);
  return versionedUrl;
};

const canUseVersionedUrl = (urlInfo) => {
  if (urlInfo.isEntryPoint) {
    return false;
  }
  return urlInfo.type !== "webmanifest";
};
