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
  createLookupPackageDirectory,
  ensureEmptyDirectory,
  readPackageAtOrNull,
  updateJsonFileSync,
  writeFileSync,
} from "@jsenv/filesystem";
import {
  ANSI,
  createDynamicLog,
  createLogger,
  createTaskLog,
  humanizeDuration,
  humanizeMemory,
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
  urlIsOrIsInsideOf,
  urlToBasename,
  urlToExtension,
  urlToFilename,
  urlToRelativeUrl,
} from "@jsenv/urls";
import { memoryUsage as processMemoryUsage } from "node:process";
import { watchSourceFiles } from "../helpers/watch_source_files.js";
import { jsenvCoreDirectoryUrl } from "../jsenv_core_directory_url.js";
import { createKitchen } from "../kitchen/kitchen.js";
import { createPackageDirectory } from "../kitchen/package_directory.js";
import { GRAPH_VISITOR } from "../kitchen/url_graph/url_graph_visitor.js";
import { jsenvPluginDirectoryReferenceEffect } from "../plugins/directory_reference_effect/jsenv_plugin_directory_reference_effect.js";
import { jsenvPluginInlining } from "../plugins/inlining/jsenv_plugin_inlining.js";
import {
  createPluginController,
  createPluginStore,
} from "../plugins/plugin_controller.js";
import { getCorePlugins } from "../plugins/plugins.js";
import { jsenvPluginReferenceAnalysis } from "../plugins/reference_analysis/jsenv_plugin_reference_analysis.js";
import { renderBuildDoneLog } from "./build_content_report.js";
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
 *        Object where keys are paths to source files and values are configuration objects for each entry point.
 *        Keys are relative to sourceDirectoryUrl or bare specifiers
 * @param {object} [params.logs]
 *        Configuration for build logging
 * @param {string|url} [params.outDirectoryUrl]
 *        Directory for temporary build files and cache
 * @param {object} [params.buildDirectoryCleanPatterns]
 *        Patterns for files to clean from build directory before building (defaults to all files)
 * @param {boolean} [params.returnBuildInlineContents]
 *        Whether to return inline contents in the result
 * @param {boolean} [params.returnBuildManifest]
 *        Whether to return build manifest in the result
 * @param {boolean} [params.returnBuildFileVersions]
 *        Whether to return file versions in the result
 * @param {AbortSignal} [params.signal]
 *        Signal to abort the build process
 * @param {boolean} [params.handleSIGINT=true]
 *        Whether to handle SIGINT for graceful shutdown
 * @param {boolean} [params.writeOnFileSystem=true]
 *        Whether to write build files to the filesystem
 * @param {boolean} [params.watch=false]
 *        Whether to enable watch mode for continuous building
 * @param {object} [params.sourceFilesConfig]
 *        Configuration for source file watching
 * @param {number} [params.cooldownBetweenFileEvents]
 *        Cooldown time between file change events in watch mode
 *
 * Entry point configuration (values in params.entryPoints):
 * @param {string} [entryPoint.buildRelativeUrl]
 *        Relative URL where this entry point will be written in the build directory
 * @param {object} [entryPoint.runtimeCompat]
 *        Runtime compatibility configuration for this entry point
 * @param {string} [entryPoint.assetsDirectory]
 *        Directory where asset files will be written for this entry point
 * @param {string|url} [entryPoint.base]
 *        Base URL prefix for references in this entry point
 * @param {boolean|object} [entryPoint.bundling=true]
 *        Whether to enable bundling for this entry point
 * @param {boolean|object} [entryPoint.minification=true]
 *        Whether to enable minification for this entry point
 * @param {boolean} [entryPoint.versioning=true]
 *        Whether to enable versioning for this entry point
 * @param {('search_param'|'filename')} [entryPoint.versioningMethod]
 *        How URLs are versioned for this entry point (defaults to "search_param")
 * @param {('none'|'inline'|'file'|'programmatic')} [entryPoint.sourcemaps]
 *        Sourcemap generation strategy for this entry point (defaults to "none")
 *
 * @return {Promise<Object>} buildReturnValue
 * @return {Promise<Object>} [buildReturnValue.buildInlineContents]
 *        Contents that are inlined into build files (if returnBuildInlineContents is true)
 * @return {Promise<Object>} [buildReturnValue.buildManifest]
 *        Map of build file paths without versioning to versioned file paths (if returnBuildManifest is true)
 * @return {Promise<Object>} [buildReturnValue.buildFileVersions]
 *        Version information for build files (if returnBuildFileVersions is true)
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
  returnBuildFileVersions,
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
            const packageConditions = [
              "development",
              "dev:*",
              "node",
              "import",
            ];
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
          if (!urlIsOrIsInsideOf(sourceUrl, sourceDirectoryUrl)) {
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
              `The value${forEntryPointOrEmpty} contains unknown keys: ${unexpectedEntryPointParamNames.join(",")}.`,
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
            if (!urlIsOrIsInsideOf(buildUrl, buildDirectoryUrl)) {
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
  let logger = createLogger({ logLevel });
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

    const applyColorOnFileRelativeUrl = (fileRelativeUrl, color) => {
      const fileUrl = new URL(fileRelativeUrl, rootPackageDirectoryUrl);
      const packageDirectoryUrl = lookupPackageDirectory(fileUrl);
      if (
        !packageDirectoryUrl ||
        packageDirectoryUrl === rootPackageDirectoryUrl
      ) {
        return ANSI.color(fileRelativeUrl, color);
      }
      const parentDirectoryUrl = new URL("../", packageDirectoryUrl).href;
      const beforePackageDirectoryName = urlToRelativeUrl(
        parentDirectoryUrl,
        rootPackageDirectoryUrl,
      );
      const packageDirectoryName = urlToFilename(packageDirectoryUrl);
      const afterPackageDirectoryUrl = urlToRelativeUrl(
        fileUrl,
        packageDirectoryUrl,
      );
      const beforePackageNameStylized = ANSI.color(
        beforePackageDirectoryName,
        color,
      );
      const packageNameStylized = ANSI.color(
        ANSI.effect(packageDirectoryName, ANSI.UNDERLINE),
        color,
      );
      const afterPackageNameStylized = ANSI.color(
        `/${afterPackageDirectoryUrl}`,
        color,
      );
      return `${beforePackageNameStylized}${packageNameStylized}${afterPackageNameStylized}`;
    };

    content += `${UNICODE.OK} ${applyColorOnFileRelativeUrl(sourceUrlToLog, ANSI.GREY)} ${ANSI.color("->", ANSI.GREY)} ${applyColorOnFileRelativeUrl(buildUrlToLog, "")}`;
    // content += " ";
    // content += ANSI.color("(", ANSI.GREY);
    // content += ANSI.color(
    //   humanizeDuration(entryBuildInfo.duration, { short: true }),
    //   ANSI.GREY,
    // );
    // content += ANSI.color(")", ANSI.GREY);
    content += "\n";
    return content;
  };
  const renderBuildEndLog = ({ duration, buildFileContents }) => {
    // tell how many files are generated in build directory
    // tell the repartition?
    // this is not really useful for single build right?

    processCpuUsageMonitoring.end();
    processMemoryUsageMonitoring.end();

    return renderBuildDoneLog({
      entryPointArray,
      duration,
      buildFileContents,
      processCpuUsage: processCpuUsageMonitoring.info,
      processMemoryUsage: processMemoryUsageMonitoring.info,
    });
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
        onBuildEnd: ({ buildFileContents, duration }) => {
          clearInterval(interval);
          dynamicLog.update("");
          dynamicLog.destroy();
          dynamicLog = null;
          logger.info("");
          logger.info(renderBuildEndLog({ duration, buildFileContents }));
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
        onBuildEnd: ({ buildFileContents, duration }) => {
          logger.info(renderBuildEndLog({ duration, buildFileContents }));
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

  const lookupPackageDirectory = createLookupPackageDirectory();
  const packageDirectory = createPackageDirectory({
    sourceDirectoryUrl,
    lookupPackageDirectory,
  });
  const packageDirectoryCache = new Map();
  packageDirectory.read = (url) => {
    const fromCache = packageDirectoryCache.get(url);
    if (fromCache !== undefined) {
      return fromCache;
    }
    return readPackageAtOrNull(url);
  };

  if (outDirectoryUrl === undefined) {
    if (
      process.env.CAPTURING_SIDE_EFFECTS ||
      (!import.meta.build &&
        urlIsOrIsInsideOf(sourceDirectoryUrl, jsenvCoreDirectoryUrl))
    ) {
      outDirectoryUrl = new URL("../.jsenv_b/", sourceDirectoryUrl).href;
    } else if (packageDirectory.url) {
      outDirectoryUrl = `${packageDirectory.url}.jsenv/`;
    }
  }
  let rootPackageDirectoryUrl;
  if (packageDirectory.url) {
    const parentPackageDirectoryUrl = packageDirectory.find(
      new URL("../", packageDirectory.url),
    );
    rootPackageDirectoryUrl = parentPackageDirectoryUrl || packageDirectory.url;
  } else {
    rootPackageDirectoryUrl = packageDirectory.url;
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
          packageDirectory,
          buildUrlsGenerator,
          someEntryPointUseNode,
        },
        entryPoint.params,
      );
      const entryPointBuildRelativeUrl = entryPoint.params.buildRelativeUrl;
      const entryBuildInfo = {
        index: entryPointIndex,
        entryReference,
        entryUrlInfo: entryReference.urlInfo,
        buildRelativeUrl: entryPointBuildRelativeUrl,
        buildFileContents: undefined,
        buildFileVersions: undefined,
        buildInlineContents: undefined,
        buildManifest: undefined,
        duration: null,
        buildEntryPoint: () => {
          const sourceUrl = new URL(
            entryPoint.sourceRelativeUrl,
            sourceDirectoryUrl,
          );
          const buildUrl = new URL(
            entryPointBuildRelativeUrl,
            buildDirectoryUrl,
          );
          const sourceUrlToLog = rootPackageDirectoryUrl
            ? urlToRelativeUrl(sourceUrl, rootPackageDirectoryUrl)
            : entryPoint.key;
          const buildUrlToLog = rootPackageDirectoryUrl
            ? urlToRelativeUrl(buildUrl, rootPackageDirectoryUrl)
            : entryPointBuildRelativeUrl;

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
            entryBuildInfo.buildFileVersions = result.buildFileVersions;
            entryBuildInfo.buildInlineContents = result.buildInlineContents;
            entryBuildInfo.buildManifest = result.buildManifest;
            entryBuildInfo.buildSideEffectFiles = result.buildSideEffectFiles;
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
    const buildFileVersions = {};
    const buildInlineContents = {};
    const buildManifest = {};
    const buildSideEffectUrlSet = new Set();
    for (const [, entryBuildInfo] of entryBuildInfoMap) {
      Object.assign(buildFileContents, entryBuildInfo.buildFileContents);
      Object.assign(buildFileVersions, entryBuildInfo.buildFileVersions);
      Object.assign(buildInlineContents, entryBuildInfo.buildInlineContents);
      Object.assign(buildManifest, entryBuildInfo.buildManifest);
      for (const buildSideEffectUrl of entryBuildInfo.buildSideEffectFiles) {
        buildSideEffectUrlSet.add(buildSideEffectUrl);
      }
    }
    if (writeOnFileSystem) {
      clearDirectorySync(buildDirectoryUrl, buildDirectoryCleanPatterns);
      const buildRelativeUrls = Object.keys(buildFileContents);
      for (const buildRelativeUrl of buildRelativeUrls) {
        const buildUrl = new URL(buildRelativeUrl, buildDirectoryUrl);
        writeFileSync(buildUrl, buildFileContents[buildRelativeUrl]);
      }
      if (buildSideEffectUrlSet.size) {
        const normalizeSideEffectFileUrl = (url) => {
          const urlRelativeToPackage = urlToRelativeUrl(
            url,
            packageDirectory.url,
          );
          return urlRelativeToPackage[0] === "."
            ? urlRelativeToPackage
            : `./${urlRelativeToPackage}`;
        };
        const updatePackageSideEffects = (sideEffectUrlSet) => {
          const packageJsonFileUrl = new URL(
            "./package.json",
            packageDirectory.url,
          ).href;
          const sideEffectRelativeUrlArray = [];
          for (const sideEffectUrl of sideEffectUrlSet) {
            sideEffectRelativeUrlArray.push(
              normalizeSideEffectFileUrl(sideEffectUrl),
            );
          }
          updateJsonFileSync(packageJsonFileUrl, {
            sideEffects: sideEffectRelativeUrlArray,
          });
        };
        const sideEffects = packageDirectory.read(
          packageDirectory.url,
        )?.sideEffects;
        if (sideEffects === false) {
          updatePackageSideEffects(buildSideEffectUrlSet);
        } else if (Array.isArray(sideEffects)) {
          const sideEffectUrlSet = new Set();
          const packageSideEffectUrlSet = new Set();
          for (const sideEffectFileRelativeUrl of sideEffects) {
            const sideEffectFileUrl = new URL(
              sideEffectFileRelativeUrl,
              packageDirectory.url,
            ).href;
            packageSideEffectUrlSet.add(sideEffectFileUrl);
          }
          let hasSomeOutdatedSideEffectUrl = false;
          for (const packageSideEffectUrl of packageSideEffectUrlSet) {
            if (
              urlIsOrIsInsideOf(packageSideEffectUrl, buildDirectoryUrl) &&
              !buildSideEffectUrlSet.has(packageSideEffectUrl)
            ) {
              hasSomeOutdatedSideEffectUrl = true;
            } else {
              sideEffectUrlSet.add(packageSideEffectUrl);
            }
          }
          let hasSomeNewSideEffectsUrl = false;
          for (const buildSideEffectUrl of buildSideEffectUrlSet) {
            if (packageSideEffectUrlSet.has(buildSideEffectUrl)) {
              continue;
            }
            hasSomeNewSideEffectsUrl = true;
            sideEffectUrlSet.add(buildSideEffectUrl);
          }
          if (hasSomeOutdatedSideEffectUrl || hasSomeNewSideEffectsUrl) {
            updatePackageSideEffects(sideEffectUrlSet);
          }
        }
      }
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
      ...(returnBuildFileVersions ? { buildFileVersions } : {}),
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
      logger = createLogger({ logLevel: "warn" });
      const result = await runBuild({
        signal: buildAbortController.signal,
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
  mode: undefined,
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
  packageConditionsConfig: undefined,
  magicExtensions: undefined,
  magicDirectoryIndex: undefined,
  directoryReferenceEffect: undefined,
  scenarioPlaceholders: undefined,
  injections: undefined,
  transpilation: {},
  preserveComments: undefined,

  versioningMethod: "search_param", // "filename", "search_param"
  versioningViaImportmap: true,
  versionLength: 8,
  lineBreakNormalization: process.platform === "win32",

  http: false,

  sourcemaps: "none",
  sourcemapsSourcesContent: undefined,
  assetManifest: false,
  assetManifestFileRelativeUrl: "asset-manifest.json",
  packageSideEffects: true,
  packageDependencies: "auto", // "auto", "ignore", "include"
};

const prepareEntryPointBuild = async (
  {
    signal,
    sourceDirectoryUrl,
    buildDirectoryUrl,
    outDirectoryUrl,
    sourceRelativeUrl,
    packageDirectory,
    buildUrlsGenerator,
    someEntryPointUseNode,
  },
  entryPointParams,
) => {
  let {
    buildRelativeUrl,
    mode,
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
    packageConditionsConfig,
    magicExtensions,
    magicDirectoryIndex,
    directoryReferenceEffect,
    scenarioPlaceholders,
    injections,
    transpilation,
    preserveComments,

    versioningMethod,
    versioningViaImportmap,
    versionLength,
    lineBreakNormalization,

    http,

    sourcemaps,
    sourcemapsSourcesContent,
    assetManifest,
    assetManifestFileRelativeUrl,
    packageSideEffects,
    packageDependencies,
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
      base = mode === "package" || someEntryPointUseNode ? "./" : "/";
    }
    if (entryPointParams.bundling === undefined) {
      bundling = true;
    }
    if (bundling === true) {
      bundling = {};
    }
    if (entryPointParams.minification === undefined) {
      if (mode === "package" || someEntryPointUseNode) {
        minification = false;
      } else {
        minification = true;
      }
    }
    if (minification === true) {
      minification = {};
    }
    if (entryPointParams.versioning === undefined) {
      if (mode === "package" || someEntryPointUseNode) {
        versioning = false;
      } else {
        versioning = true;
      }
    }
    if (entryPointParams.versioningMethod === undefined) {
      versioningMethod = entryPointDefaultParams.versioningMethod;
    }
    if (entryPointParams.assetManifest === undefined) {
      assetManifest = versioningMethod === "filename";
    }
    if (entryPointParams.preserveComments === undefined) {
      if (mode === "package" || someEntryPointUseNode) {
        preserveComments = true;
      }
    }
    if (entryPointParams.sourcemaps === undefined) {
      if (mode === "package") {
        sourcemaps = "file";
      }
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
    mode,
    initialContext: contextSharedDuringBuild,
    sourcemaps,
    sourcemapsSourcesContent,
    outDirectoryUrl: outDirectoryUrl
      ? new URL("craft/", outDirectoryUrl)
      : undefined,
    packageDirectory,
    packageDependencies,
  });

  let _getOtherEntryBuildInfo;
  const rawPluginStore = await createPluginStore([
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
    jsenvPluginMinification(minification, { preserveComments }),
    ...getCorePlugins({
      packageDirectory,
      rootDirectoryUrl: sourceDirectoryUrl,
      runtimeCompat,
      referenceAnalysis,
      nodeEsmResolution,
      packageConditions,
      packageConditionsConfig,
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
      packageSideEffects,
    }),
  ]);
  const rawPluginController = await createPluginController(
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
        includedProtocols: ["file:", "data:", "virtual:", "ignore:"],
        ignore,
        ignoreProtocol: "remove",
        build: true,
        runtimeCompat,
        mode,
        initialContext: contextSharedDuringBuild,
        sourcemaps,
        sourcemapsComment: "relative",
        sourcemapsSourcesContent,
        outDirectoryUrl: outDirectoryUrl
          ? new URL("shape/", outDirectoryUrl)
          : undefined,
        packageDirectory,
        packageDependencies,
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
      const finalPluginStore = await createPluginStore([
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
              "optimizeBuildUrlContent",
              urlInfo,
              (optimizeReturnValue) => {
                urlInfo.mutateContent(optimizeReturnValue);
              },
            );
          },
        },
        buildSpecifierManager.jsenvPluginMoveToBuildDirectory,
      ]);
      const finalPluginController = await createPluginController(
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

      const buildSideEffectFiles = [];
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

        refine_hook: {
          const refineBuildUrlContentCallbackSet = new Set();
          const refineBuildCallbackSet = new Set();
          for (const plugin of rawKitchen.pluginController.activePlugins) {
            const refineBuildUrlContent = plugin.refineBuildUrlContent;
            if (refineBuildUrlContent) {
              refineBuildUrlContentCallbackSet.add(refineBuildUrlContent);
            }
            const refineBuild = plugin.refineBuild;
            if (refineBuild) {
              refineBuildCallbackSet.add(refineBuild);
            }
          }
          if (refineBuildUrlContentCallbackSet.size) {
            GRAPH_VISITOR.forEachUrlInfoStronglyReferenced(
              finalKitchen.graph.rootUrlInfo,
              (buildUrlInfo) => {
                if (!buildUrlInfo.url.startsWith("file:")) {
                  return;
                }
                for (const refineBuildUrlContentCallback of refineBuildUrlContentCallbackSet) {
                  refineBuildUrlContentCallback(buildUrlInfo, {
                    buildUrl: buildSpecifierManager.getBuildUrl(buildUrlInfo),
                    registerBuildSideEffectFile: (buildFileUrl) => {
                      buildSideEffectFiles.push(buildFileUrl);
                    },
                  });
                }
              },
            );
          }
          if (refineBuildCallbackSet.size) {
            for (const refineBuildCallback of refineBuildCallbackSet) {
              refineBuildCallback(finalKitchen);
            }
          }
        }
      }
      const {
        buildFileContents,
        buildFileVersions,
        buildInlineContents,
        buildManifest,
      } = buildSpecifierManager.getBuildInfo();
      if (versioning && assetManifest && Object.keys(buildManifest).length) {
        buildFileContents[assetManifestFileRelativeUrl] = JSON.stringify(
          buildManifest,
          null,
          "  ",
        );
      }
      return {
        buildFileContents,
        buildFileVersions,
        buildInlineContents,
        buildManifest,
        buildSideEffectFiles,
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
