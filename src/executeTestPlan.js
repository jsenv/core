import {
  normalizeStructuredMetaMap,
  urlToFileSystemPath,
  ensureEmptyDirectory,
  resolveDirectoryUrl,
  urlToMeta,
  resolveUrl,
} from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/logger"

import {
  assertProjectDirectoryUrl,
  assertProjectDirectoryExists,
} from "./internal/argUtils.js"
import { executePlan } from "./internal/executing/executePlan.js"
import { executionIsPassed } from "./internal/executing/executionIsPassed.js"
import { generateCoverageJsonFile } from "./internal/executing/coverage_reporter/coverage_reporter_json_file.js"
import { generateCoverageHtmlDirectory } from "./internal/executing/coverage_reporter/coverage_reporter_html_directory.js"
import { generateCoverageTextLog } from "./internal/executing/coverage_reporter/coverage_reporter_text_log.js"
import { jsenvCoverageConfig } from "./jsenvCoverageConfig.js"

/**
 * Execute a list of files and log how it goes
 * @param {object} testPlan Configure files to execute and their runtimes (browsers/node)
 * @param {string|url} projectDirectoryUrl Root directory of the project
 * @param {number} [maxExecutionsInParallel=1] Maximum amount of execution in parallel
 * @param {number} [defaultMsAllocatedPerExecution=30000] Milliseconds after which execution is aborted and considered as failed by timeout
 * @param {number} [cooldownBetweenExecutions=0] Millisecond to wait between each execution
 * @param {boolean} [logMemoryHeapUsage=false] Add memory heap usage during logs
 * @param {boolean} [coverage=false] Controls if coverage is collected during files executions
 * @param {boolean} [coverageV8ConflictWarning=true] Warn when coverage from 2 executions cannot be merged
 */
export const executeTestPlan = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  compileServerLogLevel = "warn",
  launchAndExecuteLogLevel = "warn",

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  importResolutionMethod,
  importDefaultExtension,

  testPlan,

  logMemoryHeapUsage = false,
  completedExecutionLogAbbreviation = false,
  completedExecutionLogMerging = false,
  logSummary = true,
  updateProcessExitCode = true,

  maxExecutionsInParallel = 1,
  defaultMsAllocatedPerExecution = 30000,
  // stopAfterExecute: true to ensure runtime is stopped once executed
  // because we have what we wants: execution is completed and
  // we have associated coverage and capturedConsole
  // passsing false means all node process and browsers launched stays opened
  // (can eventually be used for debug)
  stopAfterExecute = true,
  cooldownBetweenExecutions = 0,
  gcBetweenExecutions = logMemoryHeapUsage,

  coverage = process.argv.includes("--cover") ||
    process.argv.includes("--coverage"),
  coverageTempDirectoryRelativeUrl = "./coverage/tmp/",
  coverageConfig = jsenvCoverageConfig,
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageForceIstanbul = false,
  coverageV8ConflictWarning = true,
  coverageTextLog = true,
  coverageJsonFile = Boolean(process.env.CI),
  coverageJsonFileLog = true,
  coverageJsonFileRelativeUrl = "./coverage/coverage.json",
  coverageHtmlDirectory = !process.env.CI,
  coverageHtmlDirectoryRelativeUrl = "./coverage/",
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
  compileServerCanReadFromFilesystem,
  compileServerCanWriteOnFilesystem,
  babelPluginMap,
  babelConfigFileUrl,
  workers,
  serviceWorkers,
  importMapInWebWorkers,
  customCompilers,
  jsenvDirectoryClean,
}) => {
  const logger = createLogger({ logLevel })

  projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
  await assertProjectDirectoryExists({ projectDirectoryUrl })

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
        // I think it is an error, it would be strange, for a given file
        // to be both covered and executed
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
    compileServerLogLevel,
    launchAndExecuteLogLevel,

    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,

    importResolutionMethod,
    importDefaultExtension,

    logMemoryHeapUsage,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    logSummary,

    defaultMsAllocatedPerExecution,
    maxExecutionsInParallel,
    stopAfterExecute,
    cooldownBetweenExecutions,
    gcBetweenExecutions,

    coverage,
    coverageConfig,
    coverageIncludeMissing,
    coverageForceIstanbul,
    coverageV8ConflictWarning,
    coverageTempDirectoryRelativeUrl,

    jsenvDirectoryClean,
    protocol,
    privateKey,
    certificate,
    ip,
    port,
    compileServerCanReadFromFilesystem,
    compileServerCanWriteOnFilesystem,
    babelPluginMap,
    babelConfigFileUrl,
    workers,
    serviceWorkers,
    importMapInWebWorkers,
    customCompilers,
  })

  if (updateProcessExitCode && !executionIsPassed(result)) {
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
        projectDirectoryUrl,
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
          projectDirectoryUrl,
          coverageHtmlDirectoryRelativeUrl,
        }),
      )
    }
    if (coverage && coverageJsonFile) {
      const coverageJsonFileUrl = resolveUrl(
        coverageJsonFileRelativeUrl,
        projectDirectoryUrl,
      )
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
