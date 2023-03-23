import { existsSync } from "node:fs"
import { URL_META } from "@jsenv/url-meta"
import {
  urlToFileSystemPath,
  urlToRelativeUrl,
  urlIsInsideOf,
} from "@jsenv/urls"
import {
  ensureEmptyDirectory,
  assertAndNormalizeDirectoryUrl,
  assertAndNormalizeFileUrl,
} from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/log"

import { lookupPackageDirectory } from "../lookup_package_directory.js"
import { pingServer } from "../ping_server.js"
import { basicFetch } from "../basic_fetch.js"
import { generateCoverageJsonFile } from "./coverage/coverage_reporter_json_file.js"
import { generateCoverageHtmlDirectory } from "./coverage/coverage_reporter_html_directory.js"
import { generateCoverageTextLog } from "./coverage/coverage_reporter_text_log.js"
import { executePlan } from "./execute_plan.js"

/**
 * Execute a list of files and log how it goes.
 * @param {Object} testPlanParameters
 * @param {string|url} testPlanParameters.testDirectoryUrl Directory containing test files
 * @param {string|url} [testPlanParameters.devServerOrigin=undefined] Jsenv dev server origin; required when executing test on browsers
 * @param {Object} testPlanParameters.testPlan Object associating patterns leading to files to runtimes where they should be executed
 * @param {boolean} [testPlanParameters.completedExecutionLogAbbreviation=false] Abbreviate completed execution information to shorten terminal output
 * @param {boolean} [testPlanParameters.completedExecutionLogMerging=false] Merge completed execution logs to shorten terminal output
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
  completedExecutionLogAbbreviation = false,
  completedExecutionLogMerging = false,
  testDirectoryUrl,
  devServerModuleUrl,
  devServerOrigin,

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

  coverageEnabled = process.argv.includes("--coverage"),
  coverageConfig = { "./**/*": true },
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageMethodForNodeJs = process.env.NODE_V8_COVERAGE
    ? "NODE_V8_COVERAGE"
    : "Profiler",
  coverageMethodForBrowsers = "playwright_api", // "istanbul" also accepted
  coverageV8ConflictWarning = true,
  coverageTempDirectoryUrl,
  coverageReportRootDirectoryUrl,
  // skip empty means empty files won't appear in the coverage reports (json and html)
  coverageReportSkipEmpty = false,
  // skip full means file with 100% coverage won't appear in coverage reports (json and html)
  coverageReportSkipFull = false,
  coverageReportTextLog = true,
  coverageReportJson = process.env.CI,
  coverageReportJsonFileUrl,
  coverageReportHtml = !process.env.CI,
  coverageReportHtmlDirectoryUrl,
  ...rest
}) => {
  let someNeedsServer = false
  let someNodeRuntime = false
  let stopDevServerNeeded = false
  const runtimes = {}
  // param validation
  {
    const unexpectedParamNames = Object.keys(rest)
    if (unexpectedParamNames.length > 0) {
      throw new TypeError(
        `${unexpectedParamNames.join(",")}: there is no such param`,
      )
    }
    testDirectoryUrl = assertAndNormalizeDirectoryUrl(
      testDirectoryUrl,
      "testDirectoryUrl",
    )
    if (!existsSync(new URL(testDirectoryUrl))) {
      throw new Error(
        `ENOENT while trying to access testDirectoryUrl at ${testDirectoryUrl}`,
      )
    }
    if (typeof testPlan !== "object") {
      throw new Error(`testPlan must be an object, got ${testPlan}`)
    }

    Object.keys(testPlan).forEach((filePattern) => {
      const filePlan = testPlan[filePattern]
      if (!filePlan) return
      Object.keys(filePlan).forEach((executionName) => {
        const executionConfig = filePlan[executionName]
        const { runtime } = executionConfig
        if (runtime) {
          runtimes[runtime.name] = runtime.version
          if (runtime.type === "browser") {
            someNeedsServer = true
          }
          if (runtime.type === "node") {
            someNodeRuntime = true
          }
        }
      })
    })

    if (someNeedsServer) {
      if (!devServerOrigin) {
        throw new TypeError(
          `devServerOrigin is required when running tests on browser(s)`,
        )
      }
      let devServerStarted = await pingServer(devServerOrigin)
      if (!devServerStarted) {
        if (!devServerModuleUrl) {
          throw new TypeError(
            `devServerModuleUrl is required when dev server is not started in order to run tests on browser(s)`,
          )
        }
        try {
          process.env.IMPORTED_BY_TEST_PLAN = "1"
          await import(devServerModuleUrl)
          delete process.env.IMPORTED_BY_TEST_PLAN
        } catch (e) {
          if (e.code === "MODULE_NOT_FOUND") {
            throw new Error(
              `Cannot find file responsible to start dev server at "${devServerModuleUrl}"`,
            )
          }
          throw e
        }
        devServerStarted = await pingServer(devServerOrigin)
        if (!devServerStarted) {
          throw new Error(
            `dev server not started after importing "${devServerModuleUrl}", ensure this module file is starting a server at "${devServerOrigin}"`,
          )
        }
        stopDevServerNeeded = true
      }
      const { sourceDirectoryUrl } = await basicFetch(
        `${devServerOrigin}/__server_params__.json`,
      )
      if (
        testDirectoryUrl !== sourceDirectoryUrl &&
        !urlIsInsideOf(testDirectoryUrl, sourceDirectoryUrl)
      ) {
        throw new Error(
          `testDirectoryUrl must be inside sourceDirectoryUrl when running tests on browser(s)`,
        )
      }
    }

    if (coverageEnabled) {
      if (typeof coverageConfig !== "object") {
        throw new TypeError(
          `coverageConfig must be an object, got ${coverageConfig}`,
        )
      }
      if (!coverageAndExecutionAllowed) {
        const associationsForExecute = URL_META.resolveAssociations(
          { execute: testPlan },
          "file:///",
        )
        const associationsForCover = URL_META.resolveAssociations(
          { cover: coverageConfig },
          "file:///",
        )
        const patternsMatchingCoverAndExecute = Object.keys(
          associationsForExecute.execute,
        ).filter((testPlanPattern) => {
          const { cover } = URL_META.applyAssociations({
            url: testPlanPattern,
            associations: associationsForCover,
          })
          return cover
        })
        if (patternsMatchingCoverAndExecute.length) {
          // It would be strange, for a given file to be both covered and executed
          throw new Error(
            createDetailedMessage(
              `some file will be both covered and executed`,
              {
                patterns: patternsMatchingCoverAndExecute,
              },
            ),
          )
        }
      }
      if (coverageReportRootDirectoryUrl === undefined) {
        coverageReportRootDirectoryUrl =
          lookupPackageDirectory(testDirectoryUrl)
      } else {
        coverageReportRootDirectoryUrl = assertAndNormalizeDirectoryUrl(
          coverageReportRootDirectoryUrl,
          "coverageReportRootDirectoryUrl",
        )
      }
      if (coverageTempDirectoryUrl === undefined) {
        coverageTempDirectoryUrl = new URL(
          "./.coverage/tmp/",
          coverageReportRootDirectoryUrl,
        )
      } else {
        coverageTempDirectoryUrl = assertAndNormalizeDirectoryUrl(
          coverageTempDirectoryUrl,
          "coverageTempDirectoryUrl",
        )
      }
      if (coverageReportJson) {
        if (coverageReportJsonFileUrl === undefined) {
          coverageReportJsonFileUrl = new URL(
            "./.coverage/coverage.json",
            coverageReportRootDirectoryUrl,
          )
        } else {
          coverageReportJsonFileUrl = assertAndNormalizeFileUrl(
            coverageReportJsonFileUrl,
            "coverageReportJsonFileUrl",
          )
        }
      }
      if (coverageReportHtml) {
        if (coverageReportHtmlDirectoryUrl === undefined) {
          coverageReportHtmlDirectoryUrl = new URL(
            "./.coverage/",
            coverageReportRootDirectoryUrl,
          )
        } else {
          coverageReportHtmlDirectoryUrl = assertAndNormalizeDirectoryUrl(
            coverageReportHtmlDirectoryUrl,
            "coverageReportHtmlDirectoryUrl",
          )
        }
      }
    }
  }

  const logger = createLogger({ logLevel })
  logger.debug(
    createDetailedMessage(`Prepare executing plan`, {
      runtimes: JSON.stringify(runtimes, null, "  "),
    }),
  )

  // param normalization
  {
    if (coverageEnabled) {
      if (Object.keys(coverageConfig).length === 0) {
        logger.warn(
          `coverageConfig is an empty object. Nothing will be instrumented for coverage so your coverage will be empty`,
        )
      }
      if (
        someNodeRuntime &&
        coverageEnabled &&
        coverageMethodForNodeJs === "NODE_V8_COVERAGE"
      ) {
        if (process.env.NODE_V8_COVERAGE) {
          // when runned multiple times, we don't want to keep previous files in this directory
          await ensureEmptyDirectory(process.env.NODE_V8_COVERAGE)
        } else {
          coverageMethodForNodeJs = "Profiler"
          logger.warn(
            createDetailedMessage(
              `process.env.NODE_V8_COVERAGE is required to generate coverage for Node.js subprocesses`,
              {
                "suggestion": `set process.env.NODE_V8_COVERAGE`,
                "suggestion 2": `use coverageMethodForNodeJs: "Profiler". But it means coverage for child_process and worker_thread cannot be collected`,
              },
            ),
          )
        }
      }
    }
  }

  testPlan = { ...testPlan, "**/.jsenv/": null }

  const result = await executePlan(testPlan, {
    signal,
    handleSIGINT,
    logger,
    logRefresh,
    logSummary,
    logRuntime,
    logEachDuration,
    logTimeUsage,
    logMemoryHeapUsage,
    logFileRelativeUrl,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    rootDirectoryUrl: testDirectoryUrl,
    devServerOrigin,

    maxExecutionsInParallel,
    defaultMsAllocatedPerExecution,
    failFast,
    keepRunning,
    cooldownBetweenExecutions,
    gcBetweenExecutions,

    coverageEnabled,
    coverageConfig,
    coverageIncludeMissing,
    coverageMethodForBrowsers,
    coverageMethodForNodeJs,
    coverageV8ConflictWarning,
    coverageTempDirectoryUrl,
  })
  if (stopDevServerNeeded) {
    basicFetch(`${devServerOrigin}/__stop__`)
  }
  if (
    updateProcessExitCode &&
    result.planSummary.counters.total !== result.planSummary.counters.completed
  ) {
    process.exitCode = 1
  }
  const planCoverage = result.planCoverage
  // planCoverage can be null when execution is aborted
  if (planCoverage) {
    const promises = []
    // keep this one first because it does ensureEmptyDirectory
    // and in case coverage json file gets written in the same directory
    // it must be done before
    if (coverageEnabled && coverageReportHtml) {
      await ensureEmptyDirectory(coverageReportHtmlDirectoryUrl)
      const htmlCoverageDirectoryIndexFileUrl = `${coverageReportHtmlDirectoryUrl}index.html`
      logger.info(
        `-> ${urlToFileSystemPath(htmlCoverageDirectoryIndexFileUrl)}`,
      )
      promises.push(
        generateCoverageHtmlDirectory(planCoverage, {
          rootDirectoryUrl: coverageReportRootDirectoryUrl,
          coverageHtmlDirectoryRelativeUrl: urlToRelativeUrl(
            coverageReportHtmlDirectoryUrl,
            coverageReportRootDirectoryUrl,
          ),
          coverageReportSkipEmpty,
          coverageReportSkipFull,
        }),
      )
    }
    if (coverageEnabled && coverageReportJson) {
      promises.push(
        generateCoverageJsonFile({
          coverage: result.planCoverage,
          coverageJsonFileUrl: coverageReportJsonFileUrl,
          logger,
        }),
      )
    }
    if (coverageEnabled && coverageReportTextLog) {
      promises.push(
        generateCoverageTextLog(result.planCoverage, {
          coverageReportSkipEmpty,
          coverageReportSkipFull,
        }),
      )
    }
    await Promise.all(promises)
  }
  return {
    testPlanAborted: result.aborted,
    testPlanSummary: result.planSummary,
    testPlanReport: result.planReport,
    testPlanCoverage: planCoverage,
  }
}
