/* eslint-disable import/max-dependencies */
import { createCancellationTokenForProcess } from "@jsenv/cancellation"
import {
  normalizeStructuredMetaMap,
  urlToFileSystemPath,
  ensureEmptyDirectory,
  resolveDirectoryUrl,
  urlToMeta,
  resolveUrl,
} from "@jsenv/util"
import { createLogger, createDetailedMessage } from "@jsenv/logger"
import { executeJsenvAsyncFunction } from "./internal/executeJsenvAsyncFunction.js"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "./internal/argUtils.js"
import { executePlan } from "./internal/executing/executePlan.js"
import { executionIsPassed } from "./internal/executing/executionIsPassed.js"
import { generateCoverageJsonFile } from "./internal/executing/coverage/generateCoverageJsonFile.js"
import { generateCoverageHtmlDirectory } from "./internal/executing/coverage/generateCoverageHtmlDirectory.js"
import { generateCoverageTextLog } from "./internal/executing/coverage/generateCoverageTextLog.js"
import { jsenvCoverageConfig } from "./jsenvCoverageConfig.js"

export const executeTestPlan = async ({
  cancellationToken = createCancellationTokenForProcess(),
  logLevel = "info",
  compileServerLogLevel = "warn",
  executionLogLevel = "warn",

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,

  importResolutionMethod,
  importDefaultExtension,

  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap,
  convertMap,
  compileGroupCount = 2,

  testPlan,
  concurrencyLimit,
  executionDefaultOptions = {},
  // stopAfterExecute: true to ensure runtime is stopped once executed
  // because we have what we wants: execution is completed and
  // we have associated coverageMap and capturedConsole
  // you can still pass false to debug what happens
  // meaning all node process and browsers launched stays opened
  stopAfterExecute = true,
  completedExecutionLogAbbreviation = false,
  completedExecutionLogMerging = false,
  logSummary = true,
  measureGlobalDuration = true,
  updateProcessExitCode = true,

  coverage = process.argv.includes("--cover") || process.argv.includes("--coverage"),
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
  coverageHtmlDirectoryRelativeUrl = "./coverage",
  coverageHtmlDirectoryIndexLog = true,
  // skip empty means empty files won't appear in the coverage reports (log and html)
  coverageSkipEmpty = false,
  // skip full means file with 100% coverage won't appear in coverage reports (log and html)
  coverageSkipFull = false,

  // for chromiumExecutablePath, firefoxExecutablePath and webkitExecutablePath
  // but we need something angostic that just forward the params hence using ...rest
  ...rest
}) => {
  return executeJsenvAsyncFunction(async () => {
    const logger = createLogger({ logLevel })

    cancellationToken.register((cancelError) => {
      if (cancelError.reason === "process SIGINT") {
        logger.info(`process SIGINT -> cancelling test execution`)
      }
    })

    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    if (typeof testPlan !== "object") {
      throw new Error(`testPlan must be an object, got ${testPlan}`)
    }

    if (coverage) {
      if (typeof coverageConfig !== "object") {
        throw new TypeError(`coverageConfig must be an object, got ${coverageConfig}`)
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
      cancellationToken,
      compileServerLogLevel,
      logger,
      executionLogLevel,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,

      importResolutionMethod,
      importDefaultExtension,

      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      babelPluginMap,
      convertMap,
      compileGroupCount,

      concurrencyLimit,
      executionDefaultOptions,
      stopAfterExecute,
      completedExecutionLogMerging,
      completedExecutionLogAbbreviation,
      logSummary,
      measureGlobalDuration,

      coverage,
      coverageConfig,
      coverageIncludeMissing,
      coverageForceIstanbul,
      coverageV8MergeConflictIsExpected,

      ...rest,
    })

    if (updateProcessExitCode && !executionIsPassed(result)) {
      process.exitCode = 1
    }

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
        logger.info(`-> ${urlToFileSystemPath(htmlCoverageDirectoryIndexFileUrl)}`)
      }
      promises.push(
        generateCoverageHtmlDirectory(result.coverageMap, {
          projectDirectoryUrl,
          coverageHtmlDirectoryRelativeUrl,
        }),
      )
    }
    if (coverage && coverageJsonFile) {
      const coverageJsonFileUrl = resolveUrl(coverageJsonFileRelativeUrl, projectDirectoryUrl)
      if (coverageJsonFileLog) {
        logger.info(`-> ${urlToFileSystemPath(coverageJsonFileUrl)}`)
      }
      promises.push(generateCoverageJsonFile(result.coverageMap, coverageJsonFileUrl))
    }
    if (coverage && coverageTextLog) {
      promises.push(
        generateCoverageTextLog(result.coverageMap, { coverageSkipEmpty, coverageSkipFull }),
      )
    }
    await Promise.all(promises)

    return {
      testPlanSummary: result.summary,
      testPlanReport: result.report,
      testPlanCoverage: result.coverageMap,
    }
  })
}
