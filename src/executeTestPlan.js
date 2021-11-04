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
  defaultMsAllocatedPerExecution,

  maxExecutionsInParallel,

  completedExecutionLogAbbreviation = false,
  completedExecutionLogMerging = false,
  logSummary = true,
  measureGlobalDuration = true,
  updateProcessExitCode = true,

  coverage = process.argv.includes("--cover") ||
    process.argv.includes("--coverage"),
  coverageTempDirectoryRelativeUrl = "./coverage/tmp/",
  coverageConfig = jsenvCoverageConfig,
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageForceIstanbul = false,
  coverageV8MergeConflictIsExpected = false,
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

  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  compileServerCanReadFromFilesystem,
  compileServerCanWriteOnFilesystem,
  babelPluginMap,
  babelConfigFileUrl,
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
    compileServerLogLevel,
    launchAndExecuteLogLevel,

    projectDirectoryUrl,
    jsenvDirectoryRelativeUrl,

    importResolutionMethod,
    importDefaultExtension,

    defaultMsAllocatedPerExecution,
    maxExecutionsInParallel,
    completedExecutionLogMerging,
    completedExecutionLogAbbreviation,
    logSummary,
    measureGlobalDuration,

    coverage,
    coverageConfig,
    coverageIncludeMissing,
    coverageForceIstanbul,
    coverageV8MergeConflictIsExpected,
    coverageTempDirectoryRelativeUrl,

    jsenvDirectoryClean,
    compileServerProtocol,
    compileServerPrivateKey,
    compileServerCertificate,
    compileServerIp,
    compileServerPort,
    compileServerCanReadFromFilesystem,
    compileServerCanWriteOnFilesystem,
    babelPluginMap,
    babelConfigFileUrl,
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
    testPlanSummary: result.planSummary,
    testPlanReport: result.planReport,
    testPlanCoverage: planCoverage,
  }
}
