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
  clearDirectorySync,
  compareFileUrls,
  ensureEmptyDirectory,
  lookupPackageDirectory,
  writeFileSync,
} from "@jsenv/filesystem";
import {
  ANSI,
  createDynamicLog,
  createLogger,
  createTaskLog,
  humanizeDuration,
  humanizeMemory,
  renderBigSection,
  renderDetails,
  UNICODE,
} from "@jsenv/humanize";
import { applyNodeEsmResolution } from "@jsenv/node-esm-resolution";
import {
  startMonitoringCpuUsage,
  startMonitoringMemoryUsage,
} from "@jsenv/os-metrics";
import { jsenvPluginBundling } from "@jsenv/plugin-bundling";
import { jsenvPluginMinification } from "@jsenv/plugin-minification";
import { jsenvPluginJsModuleFallback } from "@jsenv/plugin-transpilation";
import {
  browserDefaultRuntimeCompat,
  inferRuntimeCompatFromClosestPackage,
  nodeDefaultRuntimeCompat,
} from "@jsenv/runtime-compat";
import {
  urlIsInsideOf,
  urlToBasename,
  urlToExtension,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { memoryUsage as processMemoryUsage } from "node:process";
import { watchSourceFiles } from "../helpers/watch_source_files.js";
import { jsenvCoreDirectoryUrl } from "../jsenv_core_directory_url.js";
import { createKitchen } from "../kitchen/kitchen.js";
import { GRAPH_VISITOR } from "../kitchen/url_graph/url_graph_visitor.js";
import { jsenvPluginDirectoryReferenceEffect } from "../plugins/directory_reference_effect/jsenv_plugin_directory_reference_effect.js";
import { jsenvPluginInlining } from "../plugins/inlining/jsenv_plugin_inlining.js";
import {
  createPluginController,
  createPluginStore,
} from "../plugins/plugin_controller.js";
import { getCorePlugins } from "../plugins/plugins.js";
import { jsenvPluginReferenceAnalysis } from "../plugins/reference_analysis/jsenv_plugin_reference_analysis.js";
import { defaultRuntimeCompat, logsDefault } from "./build_params.js";
import { createBuildSpecifierManager } from "./build_specifier_manager.js";
import { createBuildUrlsGenerator } from "./build_urls_generator.js";
import { jsenvPluginLineBreakNormalization } from "./jsenv_plugin_line_break_normalization.js";
import { jsenvPluginMappings } from "./jsenv_plugin_mappings.js";

/**
 * Generate an optimized version of source files into a directory.
 *
 * @param {Object} params
 * @param {string|url} params.sourceDirectoryUrl
 *        Directory containing source files
 * @param {string|url} params.buildDirectoryUrl
 *        Directory where optimized files will be written
 * @param {object} params.entryPoints
 *        Object where keys are paths to source files and values are their future name in the build directory.
 *        Keys are relative to sourceDirectoryUrl
 * @param {object} params.runtimeCompat
 *        Code generated will be compatible with these runtimes
 * @param {string} [params.assetsDirectory]
 *        Directory where asset files will be written. By default sibling to the entry build file.
 * @param {string|url} [params.base=""]
 *        Urls in build file contents will be prefixed with this string
 * @param {boolean|object} [params.bundling=true]
 *        Reduce number of files written in the build directory
 *  @param {boolean|object} [params.minification=true]
 *        Minify the content of files written into the build directory
 * @param {boolean} [params.versioning=true]
 *        Use versioning on files written in the build directory
 * @param {('search_param'|'filename')} [params.versioningMethod="search_param"]
 *        Controls how url are versioned in the build directory
 * @param {('none'|'inline'|'file'|'programmatic')} [params.sourcemaps="none"]
 *        Generate sourcemaps in the build directory
 * @param {('error'|'copy'|'preserve')|function} [params.directoryReferenceEffect="error"]
 *        What to do when a reference leads to a directory on the filesystem
 * @return {Promise<Object>} buildReturnValue
 * @return {Promise<Object>} buildReturnValue.buildInlineContents
 *        Contains content that is inline into build files
 * @return {Promise<Object>} buildReturnValue.buildManifest
 *        Map build file paths without versioning to versioned file paths
 */
export const build = async ({
  sourceDirectoryUrl,
  buildDirectoryUrl,
  entryPoints = {},
  logs,

  outDirectoryUrl,
  buildDirectoryCleanPatterns = { "**/*": true },
  returnBuildInlineContents,
  returnBuildManifest,
  signal = new AbortController().signal,
  handleSIGINT = true,

  writeOnFileSystem = true,

  watch = false,
  sourceFilesConfig = {},
  cooldownBetweenFileEvents,

  ...rest
}) => {
  const entryPointArray = [];

  // param validation
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    // source and build directory
    {
      sourceDirectoryUrl = assertAndNormalizeDirectoryUrl(
        sourceDirectoryUrl,
        "sourceDirectoryUrl",
      );
      buildDirectoryUrl = assertAndNormalizeDirectoryUrl(
        buildDirectoryUrl,
        "buildDirectoryUrl",
      );
    }
    // entry points
    {
      if (typeof entryPoints !== "object" || entryPoints === null) {
        throw new TypeError(
          `The value "${entryPoints}" for "entryPoints" is invalid: it must be an object.`,
        );
      }
      const keys = Object.keys(entryPoints);
      const isSingleEntryPoint = keys.length === 1;
      for (const key of keys) {
        // key (sourceRelativeUrl)
        let sourceUrl;
        let runtimeType;
        {
          if (isBareSpecifier(key)) {
            const packageConditions = ["development", "node", "import"];
            try {
              const { url, type } = applyNodeEsmResolution({
                conditions: packageConditions,
                parentUrl: sourceDirectoryUrl,
                specifier: key,
              });
              if (type === "field:browser") {
                runtimeType = "browser";
              }
              sourceUrl = url;
            } catch (e) {
              throw new Error(
                `The key "${key}" in "entryPoints" is invalid: it cannot be resolved.`,
                { cause: e },
              );
            }
          } else {
            if (!key.startsWith("./")) {
              throw new TypeError(
                `The key "${key}" in "entryPoints" is invalid: it must start with "./".`,
              );
            }

            try {
              sourceUrl = new URL(key, sourceDirectoryUrl).href;
            } catch {
              throw new TypeError(
                `The key "${key}" in "entryPoints" is invalid: it must be a relative url.`,
              );
            }
          }
          if (!urlIsInsideOf(sourceUrl, sourceDirectoryUrl)) {
            throw new Error(
              `The key "${key}" in "entryPoints" is invalid: it must be inside the source directory at ${sourceDirectoryUrl}.`,
            );
          }

          if (!runtimeType) {
            const ext = urlToExtension(sourceUrl);
            if (ext === ".html" || ext === ".css") {
              runtimeType = "browser";
            }
          }
        }

        // value (entryPointParams)
        const value = entryPoints[key];
        {
          if (value === null || typeof value !== "object") {
            throw new TypeError(
              `The value "${value}" in "entryPoints" is invalid: it must be an object.`,
            );
          }
          const forEntryPointOrEmpty = isSingleEntryPoint
            ? ""
            : ` for entry point "${key}"`;
          const unexpectedEntryPointParamNames = Object.keys(value).filter(
            (key) => !Object.hasOwn(entryPointDefaultParams, key),
          );
          if (unexpectedEntryPointParamNames.length) {
            throw new TypeError(
              `The entry point value${forEntryPointOrEmpty} have unknown params: ${unexpectedEntryPointParamNames.join(",")}.`,
            );
          }
          const { versioningMethod } = value;
          if (versioningMethod !== undefined) {
            if (!["filename", "search_param"].includes(versioningMethod)) {
              throw new TypeError(
                `The versioningMethod "${versioningMethod}"${forEntryPointOrEmpty} is invalid: it must be "filename" or "search_param".`,
              );
            }
          }
          const { buildRelativeUrl } = value;
          if (buildRelativeUrl !== undefined) {
            let buildUrl;
            try {
              buildUrl = new URL(buildRelativeUrl, buildDirectoryUrl);
            } catch {
              throw new TypeError(
                `The buildRelativeUrl "${buildRelativeUrl}"${forEntryPointOrEmpty} is invalid: it must be a relative url.`,
              );
            }
            if (!urlIsInsideOf(buildUrl, buildDirectoryUrl)) {
              throw new Error(
                `The buildRelativeUrl "${buildRelativeUrl}"${forEntryPointOrEmpty} is invalid: it must be inside the build directory at ${buildDirectoryUrl}.`,
              );
            }
          }
          const { runtimeCompat } = value;
          if (runtimeCompat !== undefined) {
            if (runtimeCompat === null || typeof runtimeCompat !== "object") {
              throw new TypeError(
                `The runtimeCompat "${runtimeCompat}"${forEntryPointOrEmpty} is invalid: it must be an object.`,
              );
            }
          }
        }

        entryPointArray.push({
          key,
          sourceUrl,
          sourceRelativeUrl: `./${urlToRelativeUrl(sourceUrl, sourceDirectoryUrl)}`,
          params: { ...value },
          runtimeType,
        });
      }
    }
    // logs
    if (logs === undefined) {
      logs = logsDefault;
    } else {
      if (typeof logs !== "object") {
        throw new TypeError(
          `The value "${logs}" is invalid for param logs: it must be an object.`,
        );
      }
      const unexpectedLogsKeys = Object.keys(logs).filter(
        (key) => !Object.hasOwn(logsDefault, key),
      );
      if (unexpectedLogsKeys.length > 0) {
        throw new TypeError(
          `The param logs have unknown params: ${unexpectedLogsKeys.join(",")}.`,
        );
      }
    }
    if (outDirectoryUrl !== undefined) {
      outDirectoryUrl = assertAndNormalizeDirectoryUrl(
        outDirectoryUrl,
        "outDirectoryUrl",
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

  const cpuMonitoring = startMonitoringCpuUsage();
  operation.addEndCallback(cpuMonitoring.stop);
  const [processCpuUsageMonitoring] = cpuMonitoring;
  const memoryMonitoring = startMonitoringMemoryUsage();
  const [processMemoryUsageMonitoring] = memoryMonitoring;
  const interval = setInterval(() => {
    processCpuUsageMonitoring.measure();
    processMemoryUsageMonitoring.measure();
  }, 500).unref();
  operation.addEndCallback(() => {
    clearInterval(interval);
  });

  const logLevel = logs.level;
  const logger = createLogger({ logLevel });
  const animatedLogEnabled =
    logs.animated &&
    // canEraseProcessStdout
    process.stdout.isTTY &&
    // if there is an error during execution npm will mess up the output
    // (happens when npm runs several command in a workspace)
    // so we enable hot replace only when !process.exitCode (no error so far)
    process.exitCode !== 1;
  let startBuildLogs = () => {};

  const renderEntyPointBuildDoneLog = (
    entryBuildInfo,
    { sourceUrlToLog, buildUrlToLog },
  ) => {
    let content = "";
    content += `${UNICODE.OK} ${ANSI.color(sourceUrlToLog, ANSI.GREY)} ${ANSI.color("->", ANSI.GREY)} ${ANSI.color(buildUrlToLog, "")}`;
    content += " ";
    content += ANSI.color("(", ANSI.GREY);
    content += ANSI.color(
      humanizeDuration(entryBuildInfo.duration, { short: true }),
      ANSI.GREY,
    );
    content += ANSI.color(")", ANSI.GREY);
    content += "\n";
    return content;
  };
  const renderBuildEndLog = ({ duration }) => {
    // tell how many files are generated in build directory
    // tell the repartition?
    // this is not really useful for single build right?

    let content = "";

    const lines = [];

    let durationLine = `duration: `;
    durationLine += humanizeDuration(duration, { short: true });
    lines.push(durationLine);

    const humanizeProcessCpuUsage = (ratio) => {
      const percentageAsNumber = ratio * 100;
      const percentageAsNumberRounded = Math.round(percentageAsNumber);
      const percentage = `${percentageAsNumberRounded}%`;
      return percentage;
    };

    const humanizeProcessMemoryUsage = (value) => {
      return humanizeMemory(value, { short: true, decimals: 0 });
    };

    processCpuUsageMonitoring.end();
    processMemoryUsageMonitoring.end();

    // cpu usage
    const processCpuUsage = processCpuUsageMonitoring.info;
    let cpuUsageLine = "cpu: ";
    cpuUsageLine += `${humanizeProcessCpuUsage(processCpuUsage.end)}`;
    cpuUsageLine += renderDetails({
      med: humanizeProcessCpuUsage(processCpuUsage.median),
      min: humanizeProcessCpuUsage(processCpuUsage.min),
      max: humanizeProcessCpuUsage(processCpuUsage.max),
    });
    lines.push(cpuUsageLine);

    // memory usage
    const processMemoryUsage = processMemoryUsageMonitoring.info;
    let memoryUsageLine = "memory: ";
    memoryUsageLine += `${humanizeProcessMemoryUsage(processMemoryUsage.end)}`;
    memoryUsageLine += renderDetails({
      med: humanizeProcessMemoryUsage(processMemoryUsage.median),
      min: humanizeProcessMemoryUsage(processMemoryUsage.min),
      max: humanizeProcessMemoryUsage(processMemoryUsage.max),
    });
    lines.push(memoryUsageLine);

    content = lines.join("\n");

    return `${renderBigSection({
      title:
        entryPointArray.length === 1
          ? "build done"
          : `${entryPointArray.length} builds done`,
      content,
    })}\n`;
  };

  if (animatedLogEnabled) {
    startBuildLogs = () => {
      const startMs = Date.now();
      let dynamicLog = createDynamicLog();
      const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
      let frameIndex = 0;
      let oneWrite = false;
      const memoryHeapUsedAtStart = processMemoryUsage().heapUsed;
      const renderDynamicLog = () => {
        frameIndex = frameIndex === frames.length - 1 ? 0 : frameIndex + 1;
        let dynamicLogContent = "";
        dynamicLogContent += `${frames[frameIndex]} `;
        dynamicLogContent += `building ${entryPointArray.length} entry points`;

        const msEllapsed = Date.now() - startMs;
        const infos = [];
        const duration = humanizeDuration(msEllapsed, {
          short: true,
          decimals: 0,
          rounded: false,
        });
        infos.push(ANSI.color(duration, ANSI.GREY));
        let memoryUsageColor = ANSI.GREY;
        const memoryHeapUsed = processMemoryUsage().heapUsed;
        if (memoryHeapUsed > 2.5 * memoryHeapUsedAtStart) {
          memoryUsageColor = ANSI.YELLOW;
        } else if (memoryHeapUsed > 1.5 * memoryHeapUsedAtStart) {
          memoryUsageColor = null;
        }
        const memoryHeapUsedFormatted = humanizeMemory(memoryHeapUsed, {
          short: true,
          decimals: 0,
        });
        infos.push(ANSI.color(memoryHeapUsedFormatted, memoryUsageColor));

        const infoFormatted = infos.join(ANSI.color(`/`, ANSI.GREY));
        dynamicLogContent += ` ${ANSI.color(
          "[",
          ANSI.GREY,
        )}${infoFormatted}${ANSI.color("]", ANSI.GREY)}`;

        if (oneWrite) {
          dynamicLogContent = `\n${dynamicLogContent}`;
        }
        dynamicLogContent = `${dynamicLogContent}\n`;
        return dynamicLogContent;
      };
      dynamicLog.update(renderDynamicLog());
      const interval = setInterval(() => {
        dynamicLog.update(renderDynamicLog());
      }, 150).unref();
      signal.addEventListener("abort", () => {
        clearInterval(interval);
      });
      return {
        onEntryPointBuildStart: (
          entryBuildInfo,
          { sourceUrlToLog, buildUrlToLog },
        ) => {
          return () => {
            oneWrite = true;
            dynamicLog.clearDuringFunctionCall((write) => {
              const log = renderEntyPointBuildDoneLog(entryBuildInfo, {
                sourceUrlToLog,
                buildUrlToLog,
              });
              write(log);
            }, renderDynamicLog());
          };
        },
        onBuildEnd: ({ duration }) => {
          clearInterval(interval);
          dynamicLog.update("");
          dynamicLog.destroy();
          dynamicLog = null;
          logger.info("");
          logger.info(renderBuildEndLog({ duration }));
        },
      };
    };
  } else {
    startBuildLogs = () => {
      if (entryPointArray.length === 1) {
        const [singleEntryPoint] = entryPointArray;
        logger.info(`building ${singleEntryPoint.key}`);
      } else {
        logger.info(`building ${entryPointArray.length} entry points`);
      }
      logger.info("");
      return {
        onEntryPointBuildStart: (
          entryBuildInfo,
          { sourceUrlToLog, buildUrlToLog },
        ) => {
          return () => {
            logger.info(
              renderEntyPointBuildDoneLog(entryBuildInfo, {
                sourceUrlToLog,
                buildUrlToLog,
              }),
            );
          };
        },
        onBuildEnd: ({ duration }) => {
          logger.info("");
          logger.info(renderBuildEndLog({ duration }));
        },
      };
    };
  }

  // we want to start building the entry point that are deeper
  // - they are more likely to be small
  // - they are more likely to be referenced by highter files that will depend on them
  entryPointArray.sort((a, b) => {
    return compareFileUrls(a.sourceUrl, b.sourceUrl);
  });

  const packageDirectoryUrl = lookupPackageDirectory(sourceDirectoryUrl);
  if (outDirectoryUrl === undefined) {
    if (
      process.env.CAPTURING_SIDE_EFFECTS ||
      (!import.meta.build &&
        urlIsInsideOf(sourceDirectoryUrl, jsenvCoreDirectoryUrl))
    ) {
      outDirectoryUrl = new URL("../.jsenv_b/", sourceDirectoryUrl).href;
    } else if (packageDirectoryUrl) {
      outDirectoryUrl = `${packageDirectoryUrl}.jsenv/`;
    }
  }

  const runBuild = async ({ signal }) => {
    const startDate = Date.now();
    const { onBuildEnd, onEntryPointBuildStart } = startBuildLogs();

    const buildUrlsGenerator = createBuildUrlsGenerator({
      sourceDirectoryUrl,
      buildDirectoryUrl,
    });

    let someEntryPointUseNode = false;
    for (const entryPoint of entryPointArray) {
      let { runtimeCompat } = entryPoint.params;
      if (runtimeCompat === undefined) {
        const runtimeCompatFromPackage = inferRuntimeCompatFromClosestPackage(
          entryPoint.sourceUrl,
          {
            runtimeType: entryPoint.runtimeType,
          },
        );
        if (runtimeCompatFromPackage) {
          entryPoint.params.runtimeCompat = runtimeCompat =
            runtimeCompatFromPackage;
        } else {
          entryPoint.params.runtimeCompat = runtimeCompat =
            entryPoint.runtimeType === "browser"
              ? browserDefaultRuntimeCompat
              : nodeDefaultRuntimeCompat;
        }
      }
      if (!someEntryPointUseNode && "node" in runtimeCompat) {
        someEntryPointUseNode = true;
      }
    }

    const entryBuildInfoMap = new Map();
    let entryPointIndex = 0;
    const entryOutDirSet = new Set();
    for (const entryPoint of entryPointArray) {
      let entryOutDirCandidate = `entry_${urlToBasename(entryPoint.sourceRelativeUrl)}/`;
      let entryInteger = 1;
      while (entryOutDirSet.has(entryOutDirCandidate)) {
        entryInteger++;
        entryOutDirCandidate = `entry_${urlToBasename(entryPoint.sourceRelativeUrl)}_${entryInteger}/`;
      }
      const entryOutDirname = entryOutDirCandidate;
      entryOutDirSet.add(entryOutDirname);
      const entryOutDirectoryUrl = new URL(entryOutDirname, outDirectoryUrl);
      const { entryReference, buildEntryPoint } = await prepareEntryPointBuild(
        {
          signal,
          sourceDirectoryUrl,
          buildDirectoryUrl,
          outDirectoryUrl: entryOutDirectoryUrl,
          sourceRelativeUrl: entryPoint.sourceRelativeUrl,
          buildUrlsGenerator,
          someEntryPointUseNode,
        },
        entryPoint.params,
      );
      const entryBuildInfo = {
        index: entryPointIndex,
        entryReference,
        entryUrlInfo: entryReference.urlInfo,
        buildFileContents: undefined,
        buildInlineContents: undefined,
        buildManifest: undefined,
        duration: null,
        buildEntryPoint: () => {
          const sourceUrl = new URL(
            entryPoint.sourceRelativeUrl,
            sourceDirectoryUrl,
          );
          const buildUrl = new URL(
            entryPoint.params.buildRelativeUrl,
            buildDirectoryUrl,
          );
          const sourceUrlToLog = packageDirectoryUrl
            ? urlToRelativeUrl(sourceUrl, packageDirectoryUrl)
            : entryPoint.key;
          const buildUrlToLog = packageDirectoryUrl
            ? urlToRelativeUrl(buildUrl, packageDirectoryUrl)
            : entryPoint.params.buildRelativeUrl;

          const entryPointBuildStartMs = Date.now();
          const onEntryPointBuildEnd = onEntryPointBuildStart(entryBuildInfo, {
            sourceUrlToLog,
            buildUrlToLog,
          });
          const promise = (async () => {
            const result = await buildEntryPoint({
              getOtherEntryBuildInfo: (url) => {
                if (url === entryReference.url) {
                  return null;
                }
                const otherEntryBuildInfo = entryBuildInfoMap.get(url);
                if (!otherEntryBuildInfo) {
                  return null;
                }
                return otherEntryBuildInfo;
              },
            });
            entryBuildInfo.buildFileContents = result.buildFileContents;
            entryBuildInfo.buildInlineContents = result.buildInlineContents;
            entryBuildInfo.buildManifest = result.buildManifest;
            entryBuildInfo.duration = Date.now() - entryPointBuildStartMs;
            onEntryPointBuildEnd();
          })();
          entryBuildInfo.promise = promise;
          return promise;
        },
      };
      entryBuildInfoMap.set(entryReference.url, entryBuildInfo);
      entryPointIndex++;
    }

    const promises = [];
    for (const [, entryBuildInfo] of entryBuildInfoMap) {
      const promise = entryBuildInfo.buildEntryPoint();
      promises.push(promise);
    }
    await Promise.all(promises);

    const buildFileContents = {};
    const buildInlineContents = {};
    const buildManifest = {};
    for (const [, entryBuildInfo] of entryBuildInfoMap) {
      Object.assign(buildFileContents, entryBuildInfo.buildFileContents);
      Object.assign(buildInlineContents, entryBuildInfo.buildInlineContents);
      Object.assign(buildManifest, entryBuildInfo.buildManifest);
    }
    if (writeOnFileSystem) {
      clearDirectorySync(buildDirectoryUrl, buildDirectoryCleanPatterns);
      const buildRelativeUrls = Object.keys(buildFileContents);
      buildRelativeUrls.forEach((buildRelativeUrl) => {
        writeFileSync(
          new URL(buildRelativeUrl, buildDirectoryUrl),
          buildFileContents[buildRelativeUrl],
        );
      });
    }
    onBuildEnd({
      buildFileContents,
      buildInlineContents,
      buildManifest,
      duration: Date.now() - startDate,
    });
    return {
      ...(returnBuildInlineContents ? { buildInlineContents } : {}),
      ...(returnBuildManifest ? { buildManifest } : {}),
    };
  };

  if (!watch) {
    try {
      const result = await runBuild({
        signal: operation.signal,
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

const entryPointDefaultParams = {
  buildRelativeUrl: undefined,
  runtimeCompat: defaultRuntimeCompat,
  plugins: [],
  mappings: undefined,
  assetsDirectory: undefined,
  base: undefined,
  ignore: undefined,

  bundling: true,
  minification: true,
  versioning: true,

  referenceAnalysis: {},
  nodeEsmResolution: undefined,
  packageConditions: undefined,
  magicExtensions: undefined,
  magicDirectoryIndex: undefined,
  directoryReferenceEffect: undefined,
  scenarioPlaceholders: undefined,
  injections: undefined,
  transpilation: {},

  versioningMethod: "search_param", // "filename", "search_param"
  versioningViaImportmap: true,
  versionLength: 8,
  lineBreakNormalization: process.platform === "win32",

  http: false,

  sourcemaps: "none",
  sourcemapsSourcesContent: undefined,
  assetManifest: false,
  assetManifestFileRelativeUrl: "asset-manifest.json",
};

const prepareEntryPointBuild = async (
  {
    signal,
    sourceDirectoryUrl,
    buildDirectoryUrl,
    sourceRelativeUrl,
    outDirectoryUrl,
    buildUrlsGenerator,
    someEntryPointUseNode,
  },
  entryPointParams,
) => {
  let {
    buildRelativeUrl,
    runtimeCompat,
    plugins,
    mappings,
    assetsDirectory,
    base,
    ignore,

    bundling,
    minification,
    versioning,

    referenceAnalysis,
    nodeEsmResolution,
    packageConditions,
    magicExtensions,
    magicDirectoryIndex,
    directoryReferenceEffect,
    scenarioPlaceholders,
    injections,
    transpilation,

    versioningMethod,
    versioningViaImportmap,
    versionLength,
    lineBreakNormalization,

    http,

    sourcemaps,
    sourcemapsSourcesContent,
    assetManifest,
    assetManifestFileRelativeUrl,
  } = {
    ...entryPointDefaultParams,
    ...entryPointParams,
  };

  // param defaults and normalization
  {
    if (entryPointParams.buildRelativeUrl === undefined) {
      buildRelativeUrl = entryPointParams.buildRelativeUrl = sourceRelativeUrl;
    }
    const buildUrl = new URL(buildRelativeUrl, buildDirectoryUrl);
    entryPointParams.buildRelativeUrl = buildRelativeUrl = urlToRelativeUrl(
      buildUrl,
      buildDirectoryUrl,
    );
    if (entryPointParams.assetsDirectory === undefined) {
      const entryBuildUrl = new URL(buildRelativeUrl, buildDirectoryUrl).href;
      const entryBuildRelativeUrl = urlToRelativeUrl(
        entryBuildUrl,
        buildDirectoryUrl,
      );
      if (entryBuildRelativeUrl.includes("/")) {
        const assetDirectoryUrl = new URL("./", entryBuildUrl);
        assetsDirectory = urlToRelativeUrl(
          assetDirectoryUrl,
          buildDirectoryUrl,
        );
      } else {
        assetsDirectory = "";
      }
    }
    if (
      assetsDirectory &&
      assetsDirectory[assetsDirectory.length - 1] !== "/"
    ) {
      assetsDirectory = `${assetsDirectory}/`;
    }
    if (entryPointParams.base === undefined) {
      base = someEntryPointUseNode ? "./" : "/";
    }
    if (entryPointParams.bundling === undefined) {
      bundling = true;
    }
    if (bundling === true) {
      bundling = {};
    }
    if (entryPointParams.minification === undefined) {
      minification = !someEntryPointUseNode;
    }
    if (minification === true) {
      minification = {};
    }
    if (entryPointParams.versioning === undefined) {
      versioning = !someEntryPointUseNode;
    }
    if (entryPointParams.versioningMethod === undefined) {
      versioningMethod = entryPointDefaultParams.versioningMethod;
    }
    if (entryPointParams.assetManifest === undefined) {
      assetManifest = versioningMethod === "filename";
    }
  }

  const buildOperation = Abort.startOperation();
  buildOperation.addAbortSignal(signal);

  const explicitJsModuleConversion =
    sourceRelativeUrl.includes("?js_module_fallback") ||
    sourceRelativeUrl.includes("?as_js_classic");
  const contextSharedDuringBuild = {
    buildStep: "craft",
    buildDirectoryUrl,
    assetsDirectory,
    versioning,
    versioningViaImportmap,
  };
  const rawKitchen = createKitchen({
    signal,
    logLevel: "warn",
    rootDirectoryUrl: sourceDirectoryUrl,
    ignore,
    // during first pass (craft) we keep "ignore:" when a reference is ignored
    // so that the second pass (shape) properly ignore those urls
    ignoreProtocol: "keep",
    build: true,
    runtimeCompat,
    initialContext: contextSharedDuringBuild,
    sourcemaps,
    sourcemapsSourcesContent,
    outDirectoryUrl: outDirectoryUrl
      ? new URL("craft/", outDirectoryUrl)
      : undefined,
  });

  let _getOtherEntryBuildInfo;
  const rawPluginStore = createPluginStore([
    ...(mappings ? [jsenvPluginMappings(mappings)] : []),
    {
      name: "jsenv:other_entry_point_build_during_craft",
      fetchUrlContent: async (urlInfo) => {
        if (!_getOtherEntryBuildInfo) {
          return null;
        }
        const otherEntryBuildInfo = _getOtherEntryBuildInfo(urlInfo.url);
        if (!otherEntryBuildInfo) {
          return null;
        }
        urlInfo.otherEntryBuildInfo = otherEntryBuildInfo;
        return {
          type: "entry_build", // this ensure the rest of jsenv do not try to scan or modify the content
          content: "", // we don't know yet the content it will be known later
          filenameHint: otherEntryBuildInfo.entryUrlInfo.filenameHint,
        };
      },
    },
    ...plugins,
    ...(bundling ? [jsenvPluginBundling(bundling)] : []),
    ...(minification ? [jsenvPluginMinification(minification)] : []),
    ...getCorePlugins({
      rootDirectoryUrl: sourceDirectoryUrl,
      runtimeCompat,
      referenceAnalysis,
      nodeEsmResolution,
      packageConditions,
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
  ]);
  const rawPluginController = createPluginController(
    rawPluginStore,
    rawKitchen,
  );
  rawKitchen.setPluginController(rawPluginController);

  const rawRootUrlInfo = rawKitchen.graph.rootUrlInfo;
  let entryReference;
  await rawRootUrlInfo.dependencies.startCollecting(() => {
    entryReference = rawRootUrlInfo.dependencies.found({
      trace: { message: `"${sourceRelativeUrl}" from "entryPoints"` },
      isEntryPoint: true,
      type: "entry_point",
      specifier: sourceRelativeUrl,
      filenameHint: buildRelativeUrl,
    });
  });

  return {
    entryReference,
    buildEntryPoint: async ({ getOtherEntryBuildInfo }) => {
      craft: {
        _getOtherEntryBuildInfo = getOtherEntryBuildInfo;
        if (outDirectoryUrl) {
          await ensureEmptyDirectory(new URL(`craft/`, outDirectoryUrl));
        }
        await rawRootUrlInfo.cookDependencies({ operation: buildOperation });
      }

      const finalKitchen = createKitchen({
        name: "shape",
        logLevel: "warn",
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
        logger: createLogger({ logLevel: "warn" }),
        sourceDirectoryUrl,
        buildDirectoryUrl,
        base,
        assetsDirectory,
        buildUrlsGenerator,

        versioning,
        versioningMethod,
        versionLength,
        canUseImportmap:
          versioningViaImportmap &&
          rawKitchen.graph.getUrlInfo(entryReference.url).type === "html" &&
          rawKitchen.context.isSupportedOnCurrentClients("importmap"),
      });
      const finalPluginStore = createPluginStore([
        jsenvPluginReferenceAnalysis({
          ...referenceAnalysis,
          fetchInlineUrls: false,
          // inlineContent: false,
        }),
        jsenvPluginDirectoryReferenceEffect(directoryReferenceEffect, {
          rootDirectoryUrl: sourceDirectoryUrl,
        }),
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
        buildSpecifierManager.jsenvPluginMoveToBuildDirectory,
      ]);
      const finalPluginController = createPluginController(
        finalPluginStore,
        finalKitchen,
        {
          initialPuginsMeta: rawKitchen.pluginController.pluginsMeta,
        },
      );
      finalKitchen.setPluginController(finalPluginController);

      bundle: {
        const bundlerMap = new Map();
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
            if (bundlerMap.has(type)) {
              // first plugin to define a bundle hook wins
              continue;
            }
            bundlerMap.set(type, {
              plugin,
              bundleFunction: bundle[type],
              urlInfoMap: new Map(),
            });
          }
        }
        if (bundlerMap.size === 0) {
          break bundle;
        }
        const addToBundlerIfAny = (rawUrlInfo) => {
          const bundler = bundlerMap.get(rawUrlInfo.type);
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
                  if (referencedUrlInfo.type !== "js_module") {
                    continue;
                  }
                  addToBundlerIfAny(referencedUrlInfo);
                  continue;
                }
                addToBundlerIfAny(referencedUrlInfo);
              }
              return;
            }
            // File referenced with
            // - new URL("./file.js", import.meta.url)
            // - import.meta.resolve("./file.js")
            // are entry points that should be bundled
            // For instance we will bundle service worker/workers detected like this
            if (rawUrlInfo.type === "js_module") {
              for (const referenceToOther of rawUrlInfo.referenceToOthersSet) {
                if (
                  referenceToOther.type === "js_url" ||
                  referenceToOther.subtype === "import_meta_resolve"
                ) {
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
        for (const [, bundler] of bundlerMap) {
          const urlInfosToBundle = Array.from(bundler.urlInfoMap.values());
          if (urlInfosToBundle.length === 0) {
            continue;
          }
          await buildSpecifierManager.applyBundling({
            bundler,
            urlInfosToBundle,
          });
        }
      }

      shape: {
        finalKitchen.context.buildStep = "shape";
        if (outDirectoryUrl) {
          await ensureEmptyDirectory(new URL(`shape/`, outDirectoryUrl));
        }
        const finalRootUrlInfo = finalKitchen.graph.rootUrlInfo;
        await finalRootUrlInfo.dependencies.startCollecting(() => {
          finalRootUrlInfo.dependencies.found({
            trace: { message: `entryPoint` },
            isEntryPoint: true,
            type: "entry_point",
            specifier: entryReference.url,
          });
        });
        await finalRootUrlInfo.cookDependencies({
          operation: buildOperation,
        });
      }

      refine: {
        finalKitchen.context.buildStep = "refine";

        const htmlRefineSet = new Set();
        const registerHtmlRefine = (htmlRefine) => {
          htmlRefineSet.add(htmlRefine);
        };

        replace_placeholders: {
          await buildSpecifierManager.replacePlaceholders();
        }

        /*
         * Update <link rel="preload"> and friends after build (once we know everything)
         * - Used to remove resource hint targeting an url that is no longer used:
         *   - because of bundlings
         *   - because of import assertions transpilation (file is inlined into JS)
         */
        resync_resource_hints: {
          buildSpecifierManager.prepareResyncResourceHints({
            registerHtmlRefine,
          });
        }

        mutate_html: {
          GRAPH_VISITOR.forEach(finalKitchen.graph, (urlInfo) => {
            if (!urlInfo.url.startsWith("file:")) {
              return;
            }
            if (urlInfo.type !== "html") {
              return;
            }
            const htmlAst = parseHtml({
              html: urlInfo.content,
              url: urlInfo.url,
              storeOriginalPositions: false,
            });
            for (const htmlRefine of htmlRefineSet) {
              const htmlMutationCallbackSet = new Set();
              const registerHtmlMutation = (callback) => {
                htmlMutationCallbackSet.add(callback);
              };
              htmlRefine(htmlAst, { registerHtmlMutation });
              for (const htmlMutationCallback of htmlMutationCallbackSet) {
                htmlMutationCallback();
              }
            }
            // cleanup jsenv attributes from html as a last step
            urlInfo.content = stringifyHtmlAst(htmlAst, {
              cleanupJsenvAttributes: true,
              cleanupPositionAttributes: true,
            });
          });
        }

        inject_urls_in_service_workers: {
          const inject =
            buildSpecifierManager.prepareServiceWorkerUrlInjection();
          if (inject) {
            await inject();
            buildOperation.throwIfAborted();
          }
        }
      }
      const { buildFileContents, buildInlineContents, buildManifest } =
        buildSpecifierManager.getBuildInfo();
      if (versioning && assetManifest && Object.keys(buildManifest).length) {
        buildFileContents[assetManifestFileRelativeUrl] = JSON.stringify(
          buildManifest,
          null,
          "  ",
        );
      }
      return {
        buildFileContents,
        buildInlineContents,
        buildManifest,
      };
    },
  };
};

const isBareSpecifier = (specifier) => {
  if (
    specifier[0] === "/" ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  ) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(specifier);
    return false;
  } catch {
    return true;
  }
};
