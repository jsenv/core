import { existsSync } from "node:fs";
import { memoryUsage } from "node:process";
import { takeCoverage } from "node:v8";
import stripAnsi from "strip-ansi";
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort";
import { URL_META } from "@jsenv/url-meta";
import { urlToFileSystemPath, urlToRelativeUrl } from "@jsenv/urls";
import {
  ensureEmptyDirectory,
  assertAndNormalizeDirectoryUrl,
  assertAndNormalizeFileUrl,
  writeFileSync,
} from "@jsenv/filesystem";
import {
  createLogger,
  createDetailedMessage,
  UNICODE,
  createLog,
  startSpinner,
} from "@jsenv/log";
import {
  startGithubCheckRun,
  readGitHubWorkflowEnv,
} from "@jsenv/github-check-run";

import { createTeardown } from "../helpers/teardown.js";
import { createCallOrderer } from "../helpers/call_orderer.js";
import { reportToCoverage } from "../coverage/report_to_coverage.js";
import { generateCoverageJsonFile } from "../coverage/coverage_reporter_json_file.js";
import { generateCoverageHtmlDirectory } from "../coverage/coverage_reporter_html_directory.js";
import { generateCoverageTextLog } from "../coverage/coverage_reporter_text_log.js";
import { assertAndNormalizeWebServer } from "./web_server_param.js";
import { executionStepsFromTestPlan } from "./execution_steps.js";
import {
  createExecutionLog,
  formatSummaryLog,
  formatSummary,
} from "./logs_file_execution.js";
import { githubAnnotationFromError } from "./github_annotation_from_error.js";
import { run } from "./run.js";
import { ensureGlobalGc } from "./gc.js";

/**
 * Execute a list of files and log how it goes.
 * @param {Object} testPlanParameters
 * @param {string|url} testPlanParameters.rootDirectoryUrl Directory containing test files;
 * @param {Object} [testPlanParameters.webServer] Web server info; required when executing test on browsers
 * @param {Object} testPlanParameters.testPlan Object associating files with runtimes where they will be executed
 * @param {boolean} [testPlanParameters.logShortForCompletedExecutions=false] Abbreviate completed execution information to shorten terminal output
 * @param {boolean} [testPlanParameters.logMergeForCompletedExecutions=false] Merge completed execution logs to shorten terminal output
 * @param {number} [testPlanParameters.maxExecutionsInParallel=1] Maximum amount of execution in parallel
 * @param {number} [testPlanParameters.defaultMsAllocatedPerExecution=30000] Milliseconds after which execution is aborted and considered as failed by timeout
 * @param {boolean} [testPlanParameters.failFast=false] Fails immediatly when a test execution fails
 * @param {number} [testPlanParameters.cooldownBetweenExecutions=0] Millisecond to wait between each execution
 * @param {boolean} [testPlanParameters.logMemoryHeapUsage=false] Add memory heap usage during logs
 * @param {boolean} [testPlanParameters.coverageEnabled=false] Controls if coverage is collected during files executions
 * @param {boolean} [testPlanParameters.coverageV8ConflictWarning=true] Warn when coverage from 2 executions cannot be merged
 * @return {Object} An object containing the result of all file executions
 */
export const executeTestPlan = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  logRefresh = true,
  logRuntime = true,
  logEachDuration = true,
  logSummary = true,
  logTimeUsage = false,
  logMemoryHeapUsage = false,
  logFileRelativeUrl = ".jsenv/test_plan_debug.txt",
  logShortForCompletedExecutions = false,
  logMergeForCompletedExecutions = false,

  rootDirectoryUrl,
  webServer,
  testPlan,
  updateProcessExitCode = true,
  maxExecutionsInParallel = 1,
  defaultMsAllocatedPerExecution = 30_000,
  failFast = false,
  // keepRunning: false to ensure runtime is stopped once executed
  // because we have what we wants: execution is completed and
  // we have associated coverage and console output
  // passsing true means all node process and browsers launched stays opened
  // (can eventually be used for debug)
  keepRunning = false,
  cooldownBetweenExecutions = 0,
  gcBetweenExecutions = logMemoryHeapUsage,

  githubCheckEnabled = Boolean(process.env.GITHUB_WORKFLOW),
  githubCheckLogLevel,
  githubCheckName = "Jsenv tests",
  githubCheckTitle = "Tests executions",
  githubCheckToken,
  githubCheckRepositoryOwner,
  githubCheckRepositoryName,
  githubCheckCommitSha,

  coverageEnabled = process.argv.includes("--coverage"),
  coverageConfig = {
    "file:///**/node_modules/": false,
    "./**/.*": false,
    "./**/.*/": false,
    "./**/src/**/*.js": true,
    "./**/src/**/*.ts": true,
    "./**/src/**/*.jsx": true,
    "./**/src/**/*.tsx": true,
    "./**/tests/": false,
    "./**/*.test.html": false,
    "./**/*.test.html@*.js": false,
    "./**/*.test.js": false,
    "./**/*.test.mjs": false,
  },
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageMethodForNodeJs = process.env.NODE_V8_COVERAGE
    ? "NODE_V8_COVERAGE"
    : "Profiler",
  // - When chromium only -> coverage generated by v8
  // - When chromium + node -> coverage generated by v8 are merged
  // - When firefox only -> coverage generated by babel+istanbul
  // - When chromium + firefox
  //   -> by default only coverage from chromium is used
  //   and a warning is logged according to coverageV8ConflictWarning
  //   -> to collect coverage from both browsers, pass coverageMethodForBrowsers: "istanbul"
  coverageMethodForBrowsers, // undefined | "playwright" | "istanbul"
  coverageV8ConflictWarning = true,
  coverageTempDirectoryUrl,
  // skip empty means empty files won't appear in the coverage reports (json and html)
  coverageReportSkipEmpty = false,
  // skip full means file with 100% coverage won't appear in coverage reports (json and html)
  coverageReportSkipFull = false,
  coverageReportTextLog = true,
  coverageReportJson = process.env.CI,
  coverageReportJsonFileUrl,
  coverageReportHtml = !process.env.CI,
  coverageReportHtmlDirectoryUrl,

  beforeExecutionCallback = () => {},
  afterExecutionCallback = () => {},
  afterAllExecutionCallback = () => {},
  ...rest
}) => {
  const teardown = createTeardown();

  const beforeExecutionCallbackSet = new Set();
  const afterExecutionCallbackSet = new Set();
  const afterAllExecutionCallbackSet = new Set();
  beforeExecutionCallbackSet.add(beforeExecutionCallback);
  afterExecutionCallbackSet.add(afterExecutionCallback);
  afterAllExecutionCallbackSet.add(afterAllExecutionCallback);

  const operation = Abort.startOperation();
  operation.addAbortSignal(signal);
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        () => {
          logger.debug(`SIGINT abort`);
          abort();
        },
      );
    });
  }

  let logger;
  let someNeedsServer = false;
  let someHasCoverageV8 = false;
  let someNodeRuntime = false;
  const runtimes = {};
  // param validation
  {
    const unexpectedParamNames = Object.keys(rest);
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      );
    }
    rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
      rootDirectoryUrl,
      "rootDirectoryUrl",
    );
    if (!existsSync(new URL(rootDirectoryUrl))) {
      throw new Error(`ENOENT on rootDirectoryUrl at ${rootDirectoryUrl}`);
    }
    if (typeof testPlan !== "object") {
      throw new Error(`testPlan must be an object, got ${testPlan}`);
    }

    logger = createLogger({ logLevel });

    Object.keys(testPlan).forEach((filePattern) => {
      const filePlan = testPlan[filePattern];
      if (!filePlan) return;
      Object.keys(filePlan).forEach((executionName) => {
        const executionConfig = filePlan[executionName];
        const { runtime } = executionConfig;
        if (runtime) {
          runtimes[runtime.name] = runtime.version;
          if (runtime.type === "browser") {
            if (runtime.capabilities && runtime.capabilities.coverageV8) {
              someHasCoverageV8 = true;
            }
            someNeedsServer = true;
          }
          if (runtime.type === "node") {
            someNodeRuntime = true;
          }
        }
      });
    });

    if (someNeedsServer) {
      await assertAndNormalizeWebServer(webServer, {
        signal: operation.signal,
        teardown,
        logger,
      });
    }

    if (githubCheckEnabled && !process.env.GITHUB_TOKEN) {
      githubCheckEnabled = false;
      const suggestions = [];
      if (process.env.GITHUB_WORKFLOW_REF) {
        const workflowFileRef = process.env.GITHUB_WORKFLOW_REF;
        const refsIndex = workflowFileRef.indexOf("@refs/");
        // see "GITHUB_WORKFLOW_REF" in https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
        const workflowFilePath =
          refsIndex === -1
            ? workflowFileRef
            : workflowFileRef.slice(0, refsIndex);
        suggestions.push(`Pass github token in ${workflowFilePath} during job "${process.env.GITHUB_JOB}"
\`\`\`yml
env:
  GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
\`\`\``);
      }
      suggestions.push(`Disable github check with githubCheckEnabled: false`);
      logger.warn(
        `${
          UNICODE.WARNING
        } githubCheckEnabled but process.env.GITHUB_TOKEN is missing.
Integration with Github check API is disabled
To fix this warning:
- ${suggestions.join("\n- ")}
`,
      );
    }
    if (githubCheckEnabled) {
      const githubCheckInfoFromEnv = process.env.GITHUB_WORKFLOW
        ? readGitHubWorkflowEnv()
        : {};
      githubCheckToken = githubCheckToken || githubCheckInfoFromEnv.githubToken;
      githubCheckRepositoryOwner =
        githubCheckRepositoryOwner || githubCheckInfoFromEnv.repositoryOwner;
      githubCheckRepositoryName =
        githubCheckRepositoryName || githubCheckInfoFromEnv.repositoryName;
      githubCheckCommitSha =
        githubCheckCommitSha || githubCheckInfoFromEnv.commitSha;
    }

    if (coverageEnabled) {
      if (coverageMethodForBrowsers === undefined) {
        coverageMethodForBrowsers = someHasCoverageV8
          ? "playwright"
          : "istanbul";
      }
      if (typeof coverageConfig !== "object") {
        throw new TypeError(
          `coverageConfig must be an object, got ${coverageConfig}`,
        );
      }
      if (!coverageAndExecutionAllowed) {
        const associationsForExecute = URL_META.resolveAssociations(
          { execute: testPlan },
          "file:///",
        );
        const associationsForCover = URL_META.resolveAssociations(
          { cover: coverageConfig },
          "file:///",
        );
        const patternsMatchingCoverAndExecute = Object.keys(
          associationsForExecute.execute,
        ).filter((testPlanPattern) => {
          const { cover } = URL_META.applyAssociations({
            url: testPlanPattern,
            associations: associationsForCover,
          });
          return cover;
        });
        if (patternsMatchingCoverAndExecute.length) {
          // It would be strange, for a given file to be both covered and executed
          throw new Error(
            createDetailedMessage(
              `some file will be both covered and executed`,
              {
                patterns: patternsMatchingCoverAndExecute,
              },
            ),
          );
        }
      }

      if (coverageTempDirectoryUrl === undefined) {
        coverageTempDirectoryUrl = new URL(
          "./.coverage/tmp/",
          rootDirectoryUrl,
        );
      } else {
        coverageTempDirectoryUrl = assertAndNormalizeDirectoryUrl(
          coverageTempDirectoryUrl,
          "coverageTempDirectoryUrl",
        );
      }
      if (coverageReportJson) {
        if (coverageReportJsonFileUrl === undefined) {
          coverageReportJsonFileUrl = new URL(
            "./.coverage/coverage.json",
            rootDirectoryUrl,
          );
        } else {
          coverageReportJsonFileUrl = assertAndNormalizeFileUrl(
            coverageReportJsonFileUrl,
            "coverageReportJsonFileUrl",
          );
        }
      }
      if (coverageReportHtml) {
        if (coverageReportHtmlDirectoryUrl === undefined) {
          coverageReportHtmlDirectoryUrl = new URL(
            "./.coverage/",
            rootDirectoryUrl,
          );
        } else {
          coverageReportHtmlDirectoryUrl = assertAndNormalizeDirectoryUrl(
            coverageReportHtmlDirectoryUrl,
            "coverageReportHtmlDirectoryUrl",
          );
        }
      }
    }
  }

  logger.debug(
    createDetailedMessage(`Prepare executing plan`, {
      runtimes: JSON.stringify(runtimes, null, "  "),
    }),
  );

  // param normalization
  {
    if (coverageEnabled) {
      if (Object.keys(coverageConfig).length === 0) {
        logger.warn(
          `coverageConfig is an empty object. Nothing will be instrumented for coverage so your coverage will be empty`,
        );
      }
      if (
        someNodeRuntime &&
        coverageEnabled &&
        coverageMethodForNodeJs === "NODE_V8_COVERAGE"
      ) {
        if (process.env.NODE_V8_COVERAGE) {
          // when runned multiple times, we don't want to keep previous files in this directory
          await ensureEmptyDirectory(process.env.NODE_V8_COVERAGE);
        } else {
          coverageMethodForNodeJs = "Profiler";
          logger.warn(
            createDetailedMessage(
              `process.env.NODE_V8_COVERAGE is required to generate coverage for Node.js subprocesses`,
              {
                "suggestion": `set process.env.NODE_V8_COVERAGE`,
                "suggestion 2": `use coverageMethodForNodeJs: "Profiler". But it means coverage for child_process and worker_thread cannot be collected`,
              },
            ),
          );
        }
      }
    }
  }

  testPlan = {
    "file:///**/node_modules/": null,
    "**/*./": null,
    ...testPlan,
    "**/.jsenv/": null,
  };
  logger.debug(`Generate executions`);
  let executionSteps = await executionStepsFromTestPlan({
    signal,
    testPlan,
    rootDirectoryUrl,
  });
  logger.debug(`${executionSteps.length} executions planned`);
  if (githubCheckEnabled) {
    const githubCheckRun = await startGithubCheckRun({
      logLevel: githubCheckLogLevel,
      githubToken: githubCheckToken,
      repositoryOwner: githubCheckRepositoryOwner,
      repositoryName: githubCheckRepositoryName,
      commitSha: githubCheckCommitSha,
      checkName: githubCheckName,
      checkTitle: githubCheckTitle,
      checkSummary: `${executionSteps.length} files will be executed`,
    });
    const annotations = [];
    afterExecutionCallbackSet.add((afterExecutionInfo) => {
      const { executionResult } = afterExecutionInfo;
      const { errors = [] } = executionResult;
      for (const error of errors) {
        const annotation = githubAnnotationFromError(error, {
          rootDirectoryUrl,
          executionInfo: afterExecutionInfo,
        });
        annotations.push(annotation);
      }
    });
    afterAllExecutionCallbackSet.add(async (returnValue) => {
      const { summary } = returnValue;
      const title = "Jsenv test results";
      const summaryText = stripAnsi(formatSummary(summary));
      if (summary.counters.total !== summary.counters.completed) {
        await githubCheckRun.fail({
          title,
          summary: summaryText,
          annotations,
        });
        return;
      }
      await githubCheckRun.pass({
        title,
        summary: summaryText,
        annotations,
      });
    });
  }

  executionSteps = executionSteps.filter(
    (executionStep) => !executionStep.runtime?.disabled,
  );

  const returnValue = {
    aborted: false,
    summary: null,
    report: null,
    coverage: null,
  };
  const report = {};
  const callbacks = [];

  const multipleExecutionsOperation = Abort.startOperation();
  multipleExecutionsOperation.addAbortSignal(signal);
  const failFastAbortController = new AbortController();
  if (failFast) {
    multipleExecutionsOperation.addAbortSignal(failFastAbortController.signal);
  }

  try {
    if (gcBetweenExecutions) {
      ensureGlobalGc();
    }

    if (coverageEnabled) {
      // when runned multiple times, we don't want to keep previous files in this directory
      await ensureEmptyDirectory(coverageTempDirectoryUrl);
      callbacks.push(async () => {
        if (multipleExecutionsOperation.signal.aborted) {
          // don't try to do the coverage stuff
          return;
        }
        try {
          if (coverageMethodForNodeJs === "NODE_V8_COVERAGE") {
            takeCoverage();
            // conceptually we don't need coverage anymore so it would be
            // good to call v8.stopCoverage()
            // but it logs a strange message about "result is not an object"
          }
          const coverage = await reportToCoverage(report, {
            signal: multipleExecutionsOperation.signal,
            logger,
            rootDirectoryUrl,
            coverageConfig,
            coverageIncludeMissing,
            coverageMethodForNodeJs,
            coverageV8ConflictWarning,
          });
          returnValue.coverage = coverage;
        } catch (e) {
          if (Abort.isAbortError(e)) {
            return;
          }
          throw e;
        }
      });
    }

    const runtimeParams = {
      rootDirectoryUrl,
      webServer,

      coverageEnabled,
      coverageConfig,
      coverageMethodForBrowsers,
      coverageMethodForNodeJs,
      isTestPlan: true,
      teardown,
    };

    if (logMergeForCompletedExecutions && !process.stdout.isTTY) {
      logMergeForCompletedExecutions = false;
      logger.debug(
        `Force logMergeForCompletedExecutions to false because process.stdout.isTTY is false`,
      );
    }
    const debugLogsEnabled = logger.levels.debug;
    const executionLogsEnabled = logger.levels.info;
    const executionSpinner =
      logRefresh &&
      maxExecutionsInParallel === 1 &&
      !debugLogsEnabled &&
      executionLogsEnabled &&
      process.stdout.isTTY &&
      // if there is an error during execution npm will mess up the output
      // (happens when npm runs several command in a workspace)
      // so we enable spinner only when !process.exitCode (no error so far)
      process.exitCode !== 1;

    const startMs = Date.now();
    let rawOutput = "";
    let executionLog = createLog({ newLine: "" });
    const counters = {
      total: executionSteps.length,
      aborted: 0,
      timedout: 0,
      failed: 0,
      completed: 0,
      done: 0,
    };

    const callWhenPreviousExecutionAreDone = createCallOrderer();

    await executeInParallel({
      multipleExecutionsOperation,
      maxExecutionsInParallel,
      cooldownBetweenExecutions,
      executionSteps,
      start: async (paramsFromStep) => {
        const executionIndex = executionSteps.indexOf(paramsFromStep);
        const { executionName, fileRelativeUrl, runtime } = paramsFromStep;
        const runtimeType = runtime.type;
        const runtimeName = runtime.name;
        const runtimeVersion = runtime.version;
        const executionParams = {
          measurePerformance: false,
          collectPerformance: false,
          collectConsole: true,
          allocatedMs: defaultMsAllocatedPerExecution,
          ...paramsFromStep,
          runtimeParams: {
            fileRelativeUrl,
            ...paramsFromStep.runtimeParams,
          },
        };
        const beforeExecutionInfo = {
          fileRelativeUrl,
          runtimeType,
          runtimeName,
          runtimeVersion,
          executionIndex,
          executionParams,
          startMs: Date.now(),
          executionResult: {
            status: "executing",
          },
          counters,
          timeEllapsed: Date.now() - startMs,
          memoryHeap: memoryUsage().heapUsed,
        };
        if (typeof executionParams.allocatedMs === "function") {
          executionParams.allocatedMs =
            executionParams.allocatedMs(beforeExecutionInfo);
        }
        let spinner;
        if (executionSpinner) {
          spinner = startSpinner({
            log: executionLog,
            render: () => {
              return createExecutionLog(beforeExecutionInfo, {
                logRuntime,
                logEachDuration,
                logTimeUsage,
                logMemoryHeapUsage,
              });
            },
          });
        }
        for (const beforeExecutionCallback of beforeExecutionCallbackSet) {
          beforeExecutionCallback(beforeExecutionInfo);
        }
        const fileUrl = `${rootDirectoryUrl}${fileRelativeUrl}`;
        let executionResult;
        if (existsSync(new URL(fileUrl))) {
          executionResult = await run({
            signal: multipleExecutionsOperation.signal,
            logger,
            allocatedMs: executionParams.allocatedMs,
            keepRunning,
            mirrorConsole: false, // might be executed in parallel: log would be a mess to read
            collectConsole: executionParams.collectConsole,
            coverageEnabled,
            coverageTempDirectoryUrl,
            runtime: executionParams.runtime,
            runtimeParams: {
              ...runtimeParams,
              ...executionParams.runtimeParams,
            },
          });
        } else {
          executionResult = {
            status: "failed",
            errors: [
              new Error(
                `No file at ${fileRelativeUrl} for execution "${executionName}"`,
              ),
            ],
          };
        }
        counters.done++;
        const fileReport = report[fileRelativeUrl];
        if (fileReport) {
          fileReport[executionName] = executionResult;
        } else {
          report[fileRelativeUrl] = {
            [executionName]: executionResult,
          };
        }

        const afterExecutionInfo = {
          ...beforeExecutionInfo,
          runtimeVersion: runtime.version,
          endMs: Date.now(),
          executionResult,
        };

        if (gcBetweenExecutions) {
          global.gc();
        }
        if (executionLogsEnabled) {
          // replace spinner with this execution result
          if (spinner) {
            spinner.stop();
            spinner = null;
          }

          const timeEllapsed = Date.now() - startMs;
          const memoryHeap = memoryUsage().heapUsed;
          callWhenPreviousExecutionAreDone(executionIndex, () => {
            if (executionResult.status === "aborted") {
              counters.aborted++;
            } else if (executionResult.status === "timedout") {
              counters.timedout++;
            } else if (executionResult.status === "failed") {
              counters.failed++;
            } else if (executionResult.status === "completed") {
              counters.completed++;
            }

            const log = createExecutionLog(afterExecutionInfo, {
              logShortForCompletedExecutions,
              logRuntime,
              logEachDuration,
              ...(logTimeUsage ? { timeEllapsed } : {}),
              ...(logMemoryHeapUsage ? { memoryHeap } : {}),
            });

            executionLog.write(log);
            rawOutput += stripAnsi(log);
            const canOverwriteLog = canOverwriteLogGetter({
              logMergeForCompletedExecutions,
              executionResult,
            });
            if (canOverwriteLog) {
              // nothing to do, we reuse the current executionLog object
            } else {
              executionLog.destroy();
              executionLog = createLog({ newLine: "" });
            }
            const isLastExecutionLog =
              executionIndex === executionSteps.length - 1;
            if (isLastExecutionLog && logger.levels.info) {
              executionLog.write("\n");
            }
          });
        }
        for (const afterExecutionCallback of afterExecutionCallbackSet) {
          afterExecutionCallback(afterExecutionInfo);
        }
        const cancelRemaining =
          failFast &&
          executionResult.status !== "completed" &&
          counters.done < counters.total;
        if (cancelRemaining) {
          logger.info(`"failFast" enabled -> cancel remaining executions`);
          failFastAbortController.abort();
        }
      },
    });
    if (!keepRunning) {
      logger.debug("trigger test plan teardown");
      await teardown.trigger();
    }

    counters.cancelled = counters.total - counters.done;
    const summary = {
      counters,
      // when execution is aborted, the remaining executions are "cancelled"
      duration: Date.now() - startMs,
    };
    if (logSummary) {
      const summaryLog = formatSummaryLog(summary);
      rawOutput += stripAnsi(summaryLog);
      logger.info(summaryLog);
    }
    if (summary.counters.total !== summary.counters.completed) {
      const logFileUrl = new URL(logFileRelativeUrl, rootDirectoryUrl).href;
      writeFileSync(logFileUrl, rawOutput);
      logger.info(`-> ${urlToFileSystemPath(logFileUrl)}`);
    }
    returnValue.aborted = multipleExecutionsOperation.signal.aborted;
    returnValue.summary = summary;
    returnValue.report = report;
    for (const callback of callbacks) {
      await callback();
    }
  } finally {
    await multipleExecutionsOperation.end();
  }

  const hasFailed =
    returnValue.summary.counters.total !==
    returnValue.summary.counters.completed;
  if (updateProcessExitCode && hasFailed) {
    process.exitCode = 1;
  }
  const coverage = returnValue.coverage;
  // planCoverage can be null when execution is aborted
  if (coverage) {
    const promises = [];
    // keep this one first because it does ensureEmptyDirectory
    // and in case coverage json file gets written in the same directory
    // it must be done before
    if (coverageEnabled && coverageReportHtml) {
      await ensureEmptyDirectory(coverageReportHtmlDirectoryUrl);
      const htmlCoverageDirectoryIndexFileUrl = `${coverageReportHtmlDirectoryUrl}index.html`;
      logger.info(
        `-> ${urlToFileSystemPath(htmlCoverageDirectoryIndexFileUrl)}`,
      );
      promises.push(
        generateCoverageHtmlDirectory(coverage, {
          rootDirectoryUrl,
          coverageHtmlDirectoryRelativeUrl: urlToRelativeUrl(
            coverageReportHtmlDirectoryUrl,
            rootDirectoryUrl,
          ),
          coverageReportSkipEmpty,
          coverageReportSkipFull,
        }),
      );
    }
    if (coverageEnabled && coverageReportJson) {
      promises.push(
        generateCoverageJsonFile({
          coverage,
          coverageJsonFileUrl: coverageReportJsonFileUrl,
          logger,
        }),
      );
    }
    if (coverageEnabled && coverageReportTextLog) {
      promises.push(
        generateCoverageTextLog(coverage, {
          coverageReportSkipEmpty,
          coverageReportSkipFull,
        }),
      );
    }
    await Promise.all(promises);
  }

  for (const afterAllExecutionCallback of afterAllExecutionCallbackSet) {
    await afterAllExecutionCallback(returnValue);
  }
  return returnValue;
};

const canOverwriteLogGetter = ({
  logMergeForCompletedExecutions,
  executionResult,
}) => {
  if (!logMergeForCompletedExecutions) {
    return false;
  }
  if (executionResult.status === "aborted") {
    return true;
  }
  if (executionResult.status !== "completed") {
    return false;
  }
  const { consoleCalls = [] } = executionResult;
  if (consoleCalls.length > 0) {
    return false;
  }
  return true;
};

const executeInParallel = async ({
  multipleExecutionsOperation,
  maxExecutionsInParallel,
  cooldownBetweenExecutions,
  executionSteps,
  start,
}) => {
  const executionResults = [];
  let progressionIndex = 0;
  let remainingExecutionCount = executionSteps.length;

  const nextChunk = async () => {
    if (multipleExecutionsOperation.signal.aborted) {
      return;
    }
    const outputPromiseArray = [];
    let previousExecPromise = Promise.resolve();
    while (
      remainingExecutionCount > 0 &&
      outputPromiseArray.length < maxExecutionsInParallel
    ) {
      remainingExecutionCount--;
      const outputPromise = executeOne(progressionIndex, previousExecPromise);
      previousExecPromise = outputPromise;
      progressionIndex++;
      outputPromiseArray.push(outputPromise);
    }
    if (outputPromiseArray.length) {
      await Promise.all(outputPromiseArray);
      if (remainingExecutionCount > 0) {
        await nextChunk();
      }
    }
  };

  const executeOne = async (index, previousExecPromise) => {
    const input = executionSteps[index];
    const output = await start(input, previousExecPromise);
    if (!multipleExecutionsOperation.signal.aborted) {
      executionResults[index] = output;
    }
    if (cooldownBetweenExecutions) {
      await new Promise((resolve) =>
        setTimeout(resolve, cooldownBetweenExecutions),
      );
    }
  };

  await nextChunk();

  return executionResults;
};
