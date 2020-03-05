import {
  catchCancellation,
  createCancellationTokenForProcess,
  metaMapToSpecifierMetaMap,
  normalizeSpecifierMetaMap,
  urlToMeta,
} from "@jsenv/util"
import { createLogger } from "@jsenv/logger"
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
  launchLogLevel = "warn",
  executeLogLevel = "off",

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
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
  updateProcessExitCode = true,

  coverage = process.argv.includes("--coverage"),
  coverageConfig = jsenvCoverageConfig,
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageTextLog = true,
  coverageJsonFile = Boolean(process.env.CI),
  coverageJsonFileLog = true,
  coverageJsonFileRelativeUrl = "./coverage/coverage-final.json",
  coverageHtmlDirectory = !process.env.CI,
  coverageHtmlDirectoryRelativeUrl = "./coverage",
  coverageHtmlDirectoryIndexLog = true,

  // for chromiumExecutablePath, firefoxExecutablePath and webkitExecutablePath
  // but we need something angostic that just forward the params hence using ...rest
  ...rest
}) => {
  return catchCancellation(async () => {
    const logger = createLogger({ logLevel })
    const launchLogger = createLogger({ logLevel: launchLogLevel })
    const executeLogger = createLogger({ logLevel: executeLogLevel })

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
        const fileSpecifierMapForExecute = normalizeSpecifierMetaMap(
          metaMapToSpecifierMetaMap({
            execute: testPlan,
          }),
          "file:///",
        )

        const fileSpecifierMapForCover = normalizeSpecifierMetaMap(
          metaMapToSpecifierMetaMap({
            cover: coverageConfig,
          }),
          "file:///",
        )

        const fileSpecifierMatchingCoverAndExecuteArray = Object.keys(
          fileSpecifierMapForExecute,
        ).filter((fileUrl) => {
          return urlToMeta({
            url: fileUrl,
            specifierMetaMap: fileSpecifierMapForCover,
          }).cover
        })

        if (fileSpecifierMatchingCoverAndExecuteArray.length) {
          // I think it is an error, it would be strange, for a given file
          // to be both covered and executed
          throw new Error(`some file will be both covered and executed
--- specifiers ---
${fileSpecifierMatchingCoverAndExecuteArray.join("\n")}`)
        }
      }
    }

    const result = await executePlan({
      cancellationToken,
      compileServerLogLevel,
      logger,
      launchLogger,
      executeLogger,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      importMapFileRelativeUrl,
      importDefaultExtension,

      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      babelPluginMap,
      convertMap,
      compileGroupCount,

      plan: testPlan,
      concurrencyLimit,
      executionDefaultOptions,
      stopAfterExecute,
      completedExecutionLogMerging,
      completedExecutionLogAbbreviation,
      logSummary,

      coverage,
      coverageConfig,
      coverageIncludeMissing,

      ...rest,
    })

    if (updateProcessExitCode && !executionIsPassed(result)) {
      process.exitCode = 1
    }

    const promises = []
    if (coverage && coverageJsonFile) {
      promises.push(
        generateCoverageJsonFile({
          projectDirectoryUrl,
          coverageJsonFileRelativeUrl,
          coverageJsonFileLog,
          coverageMap: result.coverageMap,
        }),
      )
    }
    if (coverage && coverageHtmlDirectory) {
      promises.push(
        generateCoverageHtmlDirectory({
          coverageMap: result.coverageMap,
          projectDirectoryUrl,
          coverageHtmlDirectoryRelativeUrl,
          coverageHtmlDirectoryIndexLog,
        }),
      )
    }
    if (coverage && coverageTextLog) {
      promises.push(
        generateCoverageTextLog({
          coverageMap: result.coverageMap,
        }),
      )
    }
    await Promise.all(promises)

    return result
  }).catch((e) => {
    process.exitCode = 1
    throw e
  })
}
