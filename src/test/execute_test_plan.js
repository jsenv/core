import { URL_META } from "@jsenv/url-meta"
import {
  urlToFileSystemPath,
  resolveDirectoryUrl,
  urlIsInsideOf,
  urlToRelativeUrl,
} from "@jsenv/urls"
import { ensureEmptyDirectory, validateDirectoryUrl } from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/log"

import { generateCoverageJsonFile } from "./coverage/coverage_reporter_json_file.js"
import { generateCoverageHtmlDirectory } from "./coverage/coverage_reporter_html_directory.js"
import { generateCoverageTextLog } from "./coverage/coverage_reporter_text_log.js"
import { executePlan } from "./execute_plan.js"

/**
 * Execute a list of files and log how it goes.
 * @param {Object} testPlanParameters
 * @param {string|url} testPlanParameters.sourceDirectoryUrl Directory containing source and test files
 * @param {string|url} [testPlanParameters.serverOrigin=undefined] Jsenv dev server origin; required when executing test on browsers
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
  sourceDirectoryUrl,
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
  coverageTempDirectoryRelativeUrl = "./.coverage/tmp/",
  // skip empty means empty files won't appear in the coverage reports (json and html)
  coverageReportSkipEmpty = false,
  // skip full means file with 100% coverage won't appear in coverage reports (json and html)
  coverageReportSkipFull = false,
  coverageReportTextLog = true,
  coverageReportJsonFile = process.env.CI ? null : "./.coverage/coverage.json",
  coverageReportHtmlDirectory = process.env.CI ? "./.coverage/" : null,
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
    const sourceDirectoryUrlValidation =
      validateDirectoryUrl(sourceDirectoryUrl)
    if (!sourceDirectoryUrlValidation.valid) {
      throw new TypeError(
        `sourceDirectoryUrl ${sourceDirectoryUrlValidation.message}, got ${sourceDirectoryUrl}`,
      )
    }
    sourceDirectoryUrl = sourceDirectoryUrlValidation.value
    if (typeof testPlan !== "object") {
      throw new Error(`testPlan must be an object, got ${testPlan}`)
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
    }
  }

  testPlan = { ...testPlan, "**/.jsenv/": null }

  const logger = createLogger({ logLevel })
  if (Object.keys(coverageConfig).length === 0) {
    logger.warn(
      `coverageConfig is an empty object. Nothing will be instrumented for coverage so your coverage will be empty`,
    )
  }

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
    sourceDirectoryUrl,
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
    coverageTempDirectoryRelativeUrl,
  })
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
    if (coverageEnabled && coverageReportHtmlDirectory) {
      const coverageHtmlDirectoryUrl = resolveDirectoryUrl(
        coverageReportHtmlDirectory,
        sourceDirectoryUrl,
      )
      if (!urlIsInsideOf(coverageHtmlDirectoryUrl, sourceDirectoryUrl)) {
        throw new Error(
          `coverageReportHtmlDirectory must be inside sourceDirectoryUrl`,
        )
      }
      await ensureEmptyDirectory(coverageHtmlDirectoryUrl)
      const htmlCoverageDirectoryIndexFileUrl = `${coverageHtmlDirectoryUrl}index.html`
      logger.info(
        `-> ${urlToFileSystemPath(htmlCoverageDirectoryIndexFileUrl)}`,
      )
      promises.push(
        generateCoverageHtmlDirectory(planCoverage, {
          rootDirectoryUrl: sourceDirectoryUrl,
          coverageHtmlDirectoryRelativeUrl: urlToRelativeUrl(
            coverageHtmlDirectoryUrl,
            sourceDirectoryUrl,
          ),
          coverageReportSkipEmpty,
          coverageReportSkipFull,
        }),
      )
    }
    if (coverageEnabled && coverageReportJsonFile) {
      const coverageJsonFileUrl = new URL(
        coverageReportJsonFile,
        sourceDirectoryUrl,
      ).href
      promises.push(
        generateCoverageJsonFile({
          coverage: result.planCoverage,
          coverageJsonFileUrl,
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
