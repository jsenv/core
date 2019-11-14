/* eslint-disable import/max-dependencies */
import {
  catchAsyncFunctionCancellation,
  createCancellationTokenForProcessSIGINT,
} from "@jsenv/cancellation"
import { createLogger } from "@jsenv/logger"
import { pathToDirectoryUrl, resolveDirectoryUrl } from "./internal/urlUtils.js"
import { executePlan } from "./internal/test-execution/executePlan.js"
import { executionIsPassed } from "./internal/test-execution/executionIsPassed.js"
import { generateCoverageJsonFile } from "./internal/coverage/generateCoverageJsonFile.js"
import { generateCoverageHtmlDirectory } from "./internal/coverage/generateCoverageHtmlDirectory.js"
import { generateCoverageTextLog } from "./internal/coverage/generateCoverageTextLog.js"

export const executeTestPlan = async ({
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  logLevel,
  compileServerLogLevel = "off",
  launchLogLevel = "off",
  executeLogLevel = "off",

  projectDirectoryPath,
  compileDirectoryRelativePath = "./.dist/",
  compileGroupCount = 2,

  testPlan,
  throwUnhandled = true,
  measurePlanExecutionDuration = false,
  concurrencyLimit,
  executionDefaultOptions = {},
  logSummary = true,
  updateProcessExitCode = true,

  coverage = false,
  coverageConfig = {
    "./index.js": true,
    "./src/**/*.js": true,
    "./**/*.test.*": false, // contains .test. -> nope
    "./**/test/": false, // inside a test folder -> nope,
  },
  coverageIncludeMissing = true,
  coverageAndExecutionAllowed = false,
  coverageTextLog = true,
  coverageJsonFile = Boolean(process.env.CI),
  coverageJsonFileLog = true,
  coverageJsonFileRelativePath = "./coverage/coverage-final.json",
  coverageHtmlDirectory = !process.env.CI,
  coverageHtmlDirectoryRelativePath = "./coverage",
  coverageHtmlDirectoryIndexLog = true,
}) => {
  const start = async () => {
    const logger = createLogger({ logLevel })
    const launchLogger = createLogger({ logLevel: launchLogLevel })
    const executeLogger = createLogger({ logLevel: executeLogLevel })
    const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
    const compileDirectoryUrl = resolveDirectoryUrl(
      compileDirectoryRelativePath,
      projectDirectoryUrl,
    )

    const result = await executePlan({
      cancellationToken,
      compileServerLogLevel,
      logger,
      launchLogger,
      executeLogger,

      compileGroupCount,
      projectDirectoryUrl,
      compileDirectoryUrl,

      plan: testPlan,
      measurePlanExecutionDuration,
      concurrencyLimit,
      executionDefaultOptions,
      logSummary,

      coverage,
      coverageConfig,
      coverageIncludeMissing,
      coverageAndExecutionAllowed,
    })

    if (updateProcessExitCode && !executionIsPassed(result)) {
      process.exitCode = 1
    }

    const promises = []
    if (coverage && coverageJsonFile) {
      promises.push(
        generateCoverageJsonFile({
          projectDirectoryUrl,
          coverageJsonFileRelativePath,
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
          coverageHtmlDirectoryRelativePath,
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
  }

  const promise = catchAsyncFunctionCancellation(start)
  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}
