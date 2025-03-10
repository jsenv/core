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

import { Abort, raceProcessTeardownEvents } from "@jsenv/abort";
import { parseHtml, stringifyHtmlAst } from "@jsenv/ast";
import {
  assertAndNormalizeDirectoryUrl,
  ensureEmptyDirectory,
  writeFileSync,
} from "@jsenv/filesystem";
import { createLogger, createTaskLog } from "@jsenv/humanize";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";
import { jsenvPluginMinification } from "@jsenv/plugin-minification";
import { jsenvPluginJsModuleFallback } from "@jsenv/plugin-transpilation";
import { urlIsInsideOf } from "@jsenv/urls";
import { lookupPackageDirectory } from "../helpers/lookup_package_directory.js";
import { watchSourceFiles } from "../helpers/watch_source_files.js";
import { jsenvCoreDirectoryUrl } from "../jsenv_core_directory_url.js";
import { createKitchen } from "../kitchen/kitchen.js";
import { createUrlGraphSummary } from "../kitchen/url_graph/url_graph_report.js";
import { GRAPH_VISITOR } from "../kitchen/url_graph/url_graph_visitor.js";
import { jsenvPluginDirectoryReferenceEffect } from "../plugins/directory_reference_effect/jsenv_plugin_directory_reference_effect.js";
import { jsenvPluginInlining } from "../plugins/inlining/jsenv_plugin_inlining.js";
import { getCorePlugins } from "../plugins/plugins.js";
import { jsenvPluginReferenceAnalysis } from "../plugins/reference_analysis/jsenv_plugin_reference_analysis.js";
import { createBuildSpecifierManager } from "./build_specifier_manager.js";
import { jsenvPluginLineBreakNormalization } from "./jsenv_plugin_line_break_normalization.js";

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
const logsDefault = {
  level: "info",
  disabled: false,
  animation: true,
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
 * @param {boolean|object} [buildParameters.bundling=true]
 *        Reduce number of files written in the build directory
 *  @param {boolean|object} [buildParameters.minification=true]
 *        Minify the content of files written into the build directory
 * @param {boolean} [buildParameters.versioning=true]
 *        Use versioning on files written in the build directory
 * @param {('search_param'|'filename')} [buildParameters.versioningMethod="search_param"]
 *        Controls how url are versioned in the build directory
 * @param {('none'|'inline'|'file'|'programmatic')} [buildParameters.sourcemaps="none"]
 *        Generate sourcemaps in the build directory
 * @param {('error'|'copy'|'preserve')|function} [buildParameters.directoryReferenceEffect="error"]
 *        What to do when a reference leads to a directory on the filesystem
 * @return {Object} buildReturnValue
 * @return {Object} buildReturnValue.buildInlineContents
 *        Contains content that is inline into build files
 * @return {Object} buildReturnValue.buildManifest
 *        Map build file paths without versioning to versioned file paths
 */
export const build = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logs = logsDefault,
  sourceDirectoryUrl,
  buildDirectoryUrl,
  entryPoints = {},
  assetsDirectory = "",
  runtimeCompat = defaultRuntimeCompat,
  base = runtimeCompat.node ? "./" : "/",
  ignore,

  plugins = [],
  referenceAnalysis = {},
  nodeEsmResolution,
  magicExtensions,
  magicDirectoryIndex,
  directoryReferenceEffect,
  scenarioPlaceholders,
  injections,
  transpilation = {},
  bundling = true,
  minification = !runtimeCompat.node,
  versioning = !runtimeCompat.node,
  versioningMethod = "search_param", // "filename", "search_param"
  versioningViaImportmap = true,
  versionLength = 8,
  lineBreakNormalization = process.platform === "win32",

  sourceFilesConfig = {},
  cooldownBetweenFileEvents,
  watch = false,
  http = false,

  directoryToClean,
  sourcemaps = "none",
  sourcemapsSourcesContent,
  writeOnFileSystem = true,
  outDirectoryUrl,
  assetManifest = versioningMethod === "filename",
  assetManifestFileRelativeUrl = "asset-manifest.json",
  returnBuildInlineContents,
  returnBuildManifest,
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
    // logs
    {
      if (typeof logs !== "object") {
        throw new TypeError(`logs must be an object, got ${logs}`);
      }
      const unexpectedLogsKeys = Object.keys(logs).filter(
        (key) => !Object.hasOwn(logsDefault, key),
      );
      if (unexpectedLogsKeys.length > 0) {
        throw new TypeError(
          `${unexpectedLogsKeys.join(",")}: no such key on logs`,
        );
      }
      logs = { ...logsDefault, ...logs };
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
      if (
        process.env.CAPTURING_SIDE_EFFECTS ||
        (!import.meta.build &&
          urlIsInsideOf(sourceDirectoryUrl, jsenvCoreDirectoryUrl))
      ) {
        outDirectoryUrl = new URL("../.jsenv_b/", sourceDirectoryUrl);
      } else {
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
    if (bundling === true) {
      bundling = {};
    }
    if (minification === true) {
      minification = {};
    }
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

  const runBuild = async ({ signal, logLevel }) => {
    const logger = createLogger({ logLevel });
    const createBuildTask = (label) => {
      return createTaskLog(label, {
        disabled:
          logs.disabled || (!logger.levels.debug && !logger.levels.info),
        animated: logs.animation && !logger.levels.debug,
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
    let explicitJsModuleConversion = false;
    for (const entryPointKey of entryPointKeys) {
      if (entryPointKey.includes("?js_module_fallback")) {
        explicitJsModuleConversion = true;
        break;
      }
      if (entryPointKey.includes("?as_js_classic")) {
        explicitJsModuleConversion = true;
        break;
      }
    }
    const rawRedirections = new Map();
    const entryUrls = [];
    const contextSharedDuringBuild = {
      buildStep: "craft",
      buildDirectoryUrl,
      assetsDirectory,
      versioning,
      versioningViaImportmap,
    };
    const rawKitchen = createKitchen({
      signal,
      logLevel: logs.level,
      rootDirectoryUrl: sourceDirectoryUrl,
      ignore,
      // during first pass (craft) we keep "ignore:" when a reference is ignored
      // so that the second pass (shape) properly ignore those urls
      ignoreProtocol: "keep",
      build: true,
      runtimeCompat,
      initialContext: contextSharedDuringBuild,
      plugins: [
        ...plugins,
        ...(bundling ? [jsenvPluginBundling(bundling)] : []),
        ...(minification ? [jsenvPluginMinification(minification)] : []),
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
          directoryReferenceEffect,
          injections,
          transpilation: {
            babelHelpersAsImport: !explicitJsModuleConversion,
            ...transpilation,
            jsModuleFallback: false,
          },
          inlining: false,
          http,
          scenarioPlaceholders,
        }),
      ],
      sourcemaps,
      sourcemapsSourcesContent,
      outDirectoryUrl: outDirectoryUrl
        ? new URL("craft/", outDirectoryUrl)
        : undefined,
    });
    craft: {
      const generateSourceGraph = createBuildTask("generate source graph");
      try {
        if (outDirectoryUrl) {
          await ensureEmptyDirectory(new URL(`craft/`, outDirectoryUrl));
        }
        const rawRootUrlInfo = rawKitchen.graph.rootUrlInfo;
        await rawRootUrlInfo.dependencies.startCollecting(() => {
          Object.keys(entryPoints).forEach((key) => {
            const entryReference = rawRootUrlInfo.dependencies.found({
              trace: { message: `"${key}" in entryPoints parameter` },
              isEntryPoint: true,
              type: "entry_point",
              specifier: key,
              filenameHint: entryPoints[key],
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

    const finalKitchen = createKitchen({
      name: "shape",
      logLevel: logs.level,
      rootDirectoryUrl: sourceDirectoryUrl,
      // here most plugins are not there
      // - no external plugin
      // - no plugin putting reference.mustIgnore on https urls
      // At this stage it's only about redirecting urls to the build directory
      // consequently only a subset or urls are supported
      supportedProtocols: ["file:", "data:", "virtual:", "ignore:"],
      ignore,
      ignoreProtocol: "remove",
      build: true,
      runtimeCompat,
      initialContext: contextSharedDuringBuild,
      initialPluginsMeta: rawKitchen.pluginController.pluginsMeta,
      plugins: [
        jsenvPluginReferenceAnalysis({
          ...referenceAnalysis,
          fetchInlineUrls: false,
          // inlineContent: false,
        }),
        jsenvPluginDirectoryReferenceEffect(directoryReferenceEffect),
        ...(lineBreakNormalization
          ? [jsenvPluginLineBreakNormalization()]
          : []),
        jsenvPluginJsModuleFallback({
          remapImportSpecifier: (specifier, parentUrl) => {
            return buildSpecifierManager.remapPlaceholder(specifier, parentUrl);
          },
        }),
        jsenvPluginInlining(),
        {
          name: "jsenv:optimize",
          appliesDuring: "build",
          transformUrlContent: async (urlInfo) => {
            await rawKitchen.pluginController.callAsyncHooks(
              "optimizeUrlContent",
              urlInfo,
              (optimizeReturnValue) => {
                urlInfo.mutateContent(optimizeReturnValue);
              },
            );
          },
        },
      ],
      sourcemaps,
      sourcemapsComment: "relative",
      sourcemapsSourcesContent,
      outDirectoryUrl: outDirectoryUrl
        ? new URL("shape/", outDirectoryUrl)
        : undefined,
    });

    const buildSpecifierManager = createBuildSpecifierManager({
      rawKitchen,
      finalKitchen,
      logger,
      sourceDirectoryUrl,
      buildDirectoryUrl,
      base,
      assetsDirectory,

      versioning,
      versioningMethod,
      versionLength,
      canUseImportmap:
        versioningViaImportmap &&
        entryUrls.every((finalEntryUrl) => {
          const entryUrlInfo = rawKitchen.graph.getUrlInfo(finalEntryUrl);
          return entryUrlInfo.type === "html";
        }) &&
        rawKitchen.context.isSupportedOnCurrentClients("importmap"),
    });
    finalKitchen.pluginController.pushPlugin(
      buildSpecifierManager.jsenvPluginMoveToBuildDirectory,
    );

    const bundlers = {};
    bundle: {
      for (const plugin of rawKitchen.pluginController.activePlugins) {
        const bundle = plugin.bundle;
        if (!bundle) {
          continue;
        }
        if (typeof bundle !== "object") {
          throw new Error(
            `bundle must be an object, found "${bundle}" on plugin named "${plugin.name}"`,
          );
        }
        for (const type of Object.keys(bundle)) {
          const bundleFunction = bundle[type];
          if (!bundleFunction) {
            continue;
          }
          const bundlerForThatType = bundlers[type];
          if (bundlerForThatType) {
            // first plugin to define a bundle hook wins
            continue;
          }
          bundlers[type] = {
            plugin,
            bundleFunction: bundle[type],
            urlInfoMap: new Map(),
          };
        }
      }
      const addToBundlerIfAny = (rawUrlInfo) => {
        const bundler = bundlers[rawUrlInfo.type];
        if (bundler) {
          bundler.urlInfoMap.set(rawUrlInfo.url, rawUrlInfo);
        }
      };
      // ignore unused urls thanks to "forEachUrlInfoStronglyReferenced"
      // it avoid bundling things that are not actually used
      // happens for:
      // - js import assertions
      // - conversion to js classic using ?as_js_classic or ?js_module_fallback
      GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
        rawKitchen.graph.rootUrlInfo,
        (rawUrlInfo) => {
          if (rawUrlInfo.isEntryPoint) {
            addToBundlerIfAny(rawUrlInfo);
          }
          if (rawUrlInfo.type === "html") {
            for (const referenceToOther of rawUrlInfo.referenceToOthersSet) {
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
                  continue;
                }
              }
              if (referenceToOther.isWeak) {
                continue;
              }
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
                continue;
              }
              addToBundlerIfAny(referencedUrlInfo);
            }
            return;
          }
          // File referenced with new URL('./file.js', import.meta.url)
          // are entry points that should be bundled
          // For instance we will bundle service worker/workers detected like this
          if (rawUrlInfo.type === "js_module") {
            for (const referenceToOther of rawUrlInfo.referenceToOthersSet) {
              if (referenceToOther.type === "js_url") {
                const referencedUrlInfo = referenceToOther.urlInfo;
                let isAlreadyBundled = false;
                for (const referenceFromOther of referencedUrlInfo.referenceFromOthersSet) {
                  if (referenceFromOther.url === referencedUrlInfo.url) {
                    if (
                      referenceFromOther.subtype === "import_dynamic" ||
                      referenceFromOther.type === "script"
                    ) {
                      isAlreadyBundled = true;
                      break;
                    }
                  }
                }
                if (!isAlreadyBundled) {
                  addToBundlerIfAny(referencedUrlInfo);
                }
                continue;
              }
              if (referenceToOther.type === "js_inline_content") {
                // we should bundle it too right?
              }
            }
          }
        },
      );
      for (const type of Object.keys(bundlers)) {
        const bundler = bundlers[type];
        const urlInfosToBundle = Array.from(bundler.urlInfoMap.values());
        if (urlInfosToBundle.length === 0) {
          continue;
        }
        const bundleTask = createBuildTask(`bundle "${type}"`);
        try {
          await buildSpecifierManager.applyBundling({
            bundler,
            urlInfosToBundle,
          });
        } catch (e) {
          bundleTask.fail();
          throw e;
        }
        bundleTask.done();
      }
    }

    shape: {
      finalKitchen.context.buildStep = "shape";
      const generateBuildGraph = createBuildTask("generate build graph");
      try {
        if (outDirectoryUrl) {
          await ensureEmptyDirectory(new URL(`shape/`, outDirectoryUrl));
        }
        const finalRootUrlInfo = finalKitchen.graph.rootUrlInfo;
        await finalRootUrlInfo.dependencies.startCollecting(() => {
          entryUrls.forEach((entryUrl) => {
            finalRootUrlInfo.dependencies.found({
              trace: { message: `entryPoint` },
              isEntryPoint: true,
              type: "entry_point",
              specifier: entryUrl,
            });
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

    refine: {
      finalKitchen.context.buildStep = "refine";
      replace_placeholders: {
        await buildSpecifierManager.replacePlaceholders();
      }
      cleanup_jsenv_attributes_from_html: {
        GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
          if (!urlInfo.url.startsWith("file:")) {
            return;
          }
          if (urlInfo.type === "html") {
            const htmlAst = parseHtml({
              html: urlInfo.content,
              url: urlInfo.url,
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
        const resync = buildSpecifierManager.prepareResyncResourceHints();
        if (resync) {
          const resyncTask = createBuildTask("resync resource hints");
          resync();
          buildOperation.throwIfAborted();
          resyncTask.done();
        }
      }
      inject_urls_in_service_workers: {
        const inject = buildSpecifierManager.prepareServiceWorkerUrlInjection();
        if (inject) {
          const urlsInjectionInSw = createBuildTask(
            "inject urls in service worker",
          );
          await inject();
          urlsInjectionInSw.done();
          buildOperation.throwIfAborted();
        }
      }
    }
    const { buildFileContents, buildInlineContents, buildManifest } =
      buildSpecifierManager.getBuildInfo();
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
      createUrlGraphSummary(finalKitchen.graph, {
        title: "build files",
      }),
    );
    return {
      ...(returnBuildInlineContents ? { buildInlineContents } : {}),
      ...(returnBuildManifest ? { buildManifest } : {}),
    };
  };

  if (!watch) {
    try {
      const result = await runBuild({
        signal: operation.signal,
        logLevel: logs.level,
      });
      return result;
    } finally {
      await operation.end();
    }
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
