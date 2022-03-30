import {
  normalizeStructuredMetaMap,
  urlToFileSystemPath,
  ensureEmptyDirectory,
  resolveDirectoryUrl,
  urlToMeta,
  assertAndNormalizeDirectoryUrl,
} from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/logger"

import { generateCoverageJsonFile } from "@jsenv/utils/coverage/coverage_reporter_json_file.js"
import { generateCoverageHtmlDirectory } from "@jsenv/utils/coverage/coverage_reporter_html_directory.js"
import { generateCoverageTextLog } from "@jsenv/utils/coverage/coverage_reporter_text_log.js"
import { executePlan } from "./execute_plan.js"

/**
 * Execute a list of files and log how it goes
 * @param {Object} testPlanParameters
 * @param {string|url} testPlanParameters.rootDirectoryUrl Root directory of the project
 * @param {Object} testPlanParameters.testPlan Object associating patterns leading to files to runtimes where they should be executed
 * @param {boolean} [testPlanParameters.completedExecutionLogAbbreviation=false] Abbreviate completed execution information to shorten terminal output
 * @param {boolean} [testPlanParameters.completedExecutionLogMerging=false] Merge completed execution logs to shorten terminal output
 * @param {number} [testPlanParameters.maxExecutionsInParallel=1] Maximum amount of execution in parallel
 * @param {number} [testPlanParameters.defaultMsAllocatedPerExecution=30000] Milliseconds after which execution is aborted and considered as failed by timeout
 * @param {boolean} [testPlanParameters.failFast=false] Fails immediatly when a test execution fails
 * @param {number} [testPlanParameters.cooldownBetweenExecutions=0] Millisecond to wait between each execution
 * @param {boolean} [testPlanParameters.logMemoryHeapUsage=false] Add memory heap usage during logs
 * @param {boolean} [testPlanParameters.coverage=false] Controls if coverage is collected during files executions
 * @param {boolean} [testPlanParameters.coverageV8ConflictWarning=true] Warn when coverage from 2 executions cannot be merged
 * @return {Object} An object containing the result of all file executions
 */
export const executeTestPlan = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  logSummary = true,
  logMemoryHeapUsage = false,
  logFileRelativeUrl = ".jsenv/test_plan_debug.txt",
  completedExecutionLogAbbreviation = false,
  completedExecutionLogMerging = false,
  rootDirectoryUrl,

  testPlan,
  updateProcessExitCode = true,
  maxExecutionsInParallel = 1,
  defaultMsAllocatedPerExecution = 30000,
  failFast = false,
  // keepRunning: false to ensure runtime is stopped once executed
  // because we have what we wants: execution is completed and
  // we have associated coverage and console output
  // passsing true means all node process and browsers launched stays opened
  // (can eventually be used for debug)
  keepRunning = false,
  cooldownBetweenExecutions = 0,
  gcBetweenExecutions = logMemoryHeapUsage,

  coverage = process.argv.includes("--cover") ||
    process.argv.includes("--coverage"),
  coverageTempDirectoryRelativeUrl = "./.coverage/tmp/",
  coverageConfig = {
    "./index.js": true,
    "./main.js": true,
    "./src/**/*.js": true,
    "./**/*.test.*": false, // contains .test. -> nope
    "./**/test/": false, // inside a test folder -> nope,
  },
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageForceIstanbul = false,
  coverageV8ConflictWarning = true,
  coverageTextLog = true,
  coverageJsonFile = Boolean(process.env.CI),
  coverageJsonFileLog = true,
  coverageJsonFileRelativeUrl = "./.coverage/coverage.json",
  coverageHtmlDirectory = !process.env.CI,
  coverageHtmlDirectoryRelativeUrl = "./.coverage/",
  coverageHtmlDirectoryIndexLog = true,
  // skip empty means empty files won't appear in the coverage reports (log and html)
  coverageSkipEmpty = false,
  // skip full means file with 100% coverage won't appear in coverage reports (log and html)
  coverageSkipFull = false,

  protocol,
  privateKey,
  certificate,
  ip,
  port,
}) => {
  const logger = createLogger({ logLevel })
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  if (typeof testPlan !== "object") {
    throw new Error(`testPlan must be an object, got ${testPlan}`)
  }
  if (coverage) {
    if (typeof coverageConfig !== "object") {
      throw new TypeError(
        `coverageConfig must be an object, got ${coverageConfig}`,
      )
    }
    if (Object.keys(coverageConfig).length === 0) {
      logger.warn(
        `coverageConfig is an empty object. Nothing will be instrumented for coverage so your coverage will be empty`,
      )
    }
    if (!coverageAndExecutionAllowed) {
      const structuredMetaMapForExecute = normalizeStructuredMetaMap(
        {
          execute: testPlan,
        },
        "file:///",
      )
      const structuredMetaMapForCover = normalizeStructuredMetaMap(
        {
          cover: coverageConfig,
        },
        "file:///",
      )
      const patternsMatchingCoverAndExecute = Object.keys(
        structuredMetaMapForExecute.execute,
      ).filter((testPlanPattern) => {
        return urlToMeta({
          url: testPlanPattern,
          structuredMetaMap: structuredMetaMapForCover,
        }).cover
      })
      if (patternsMatchingCoverAndExecute.length) {
        // It would be strange, for a given file to be both covered and executed
        throw new Error(
          createDetailedMessage(`some file will be both covered and executed`, {
            patterns: patternsMatchingCoverAndExecute,
          }),
        )
      }
    }
  }
  const result = await executePlan(testPlan, {
    signal,
    handleSIGINT,
    logger,
    logLevel,
    logSummary,
    logMemoryHeapUsage,
    logFileRelativeUrl,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,

    rootDirectoryUrl,
    maxExecutionsInParallel,
    defaultMsAllocatedPerExecution,
    failFast,
    keepRunning,
    cooldownBetweenExecutions,
    gcBetweenExecutions,

    coverage,
    coverageConfig,
    coverageIncludeMissing,
    coverageForceIstanbul,
    coverageV8ConflictWarning,
    coverageTempDirectoryRelativeUrl,

    protocol,
    privateKey,
    certificate,
    ip,
    port,
  })
  if (
    updateProcessExitCode &&
    result.planSummary.executionCount !== result.planSummary.counters.completed
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
    if (coverage && coverageHtmlDirectory) {
      const coverageHtmlDirectoryUrl = resolveDirectoryUrl(
        coverageHtmlDirectoryRelativeUrl,
        rootDirectoryUrl,
      )
      await ensureEmptyDirectory(coverageHtmlDirectoryUrl)
      if (coverageHtmlDirectoryIndexLog) {
        const htmlCoverageDirectoryIndexFileUrl = `${coverageHtmlDirectoryUrl}index.html`
        logger.info(
          `-> ${urlToFileSystemPath(htmlCoverageDirectoryIndexFileUrl)}`,
        )
      }
      promises.push(
        generateCoverageHtmlDirectory(planCoverage, {
          rootDirectoryUrl,
          coverageHtmlDirectoryRelativeUrl,
        }),
      )
    }
    if (coverage && coverageJsonFile) {
      const coverageJsonFileUrl = new URL(
        coverageJsonFileRelativeUrl,
        rootDirectoryUrl,
      ).href
      promises.push(
        generateCoverageJsonFile({
          coverage: result.planCoverage,
          coverageJsonFileUrl,
          coverageJsonFileLog,
          logger,
        }),
      )
    }
    if (coverage && coverageTextLog) {
      promises.push(
        generateCoverageTextLog(result.planCoverage, {
          coverageSkipEmpty,
          coverageSkipFull,
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
