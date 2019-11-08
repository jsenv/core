/* eslint-disable import/max-dependencies */
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "@dmail/cancellation"
import { createLogger } from "@jsenv/logger"
import { pathToDirectoryUrl, resolveDirectoryUrl } from "./private/urlUtils.js"
import { executePlan } from "./private/test-execution/executePlan.js"
import { executionIsPassed } from "./private/test-execution/executionIsPassed.js"
import { generateCoverageJsonFile } from "./private/coverage/generateCoverageJsonFile.js"
import { generateCoverageHtmlDirectory } from "./private/coverage/generateCoverageHtmlDirectory.js"
import { generateCoverageConsoleReport } from "./private/coverage/generateCoverageConsoleReport.js"

export const executeTestPlan = async ({
  cancellationToken = createProcessInterruptionCancellationToken(),
  logLevel,
  compileServerLogLevel = "off",
  launchLogLevel = "off",
  executeLogLevel = "off",

  testPlan,

  projectDirectoryPath,
  compileDirectoryRelativePath = "./.dist/",

  updateProcessExitCode = true,
  throwUnhandled = true,

  coverageJsonFile = true,
  coverageJsonFileLog = true,
  coverageJsonFileRelativePath = "./coverage/coverage-final.json",
  coverageConsole = false,
  coverageHtmlDirectory = false,
  coverageHtmlDirectoryRelativePath = "./coverage",
  coverageHtmlDirectoryIndexLog = true,

  ...rest
}) => {
  const start = async () => {
    const logger = createLogger({ logLevel })
    const compileServerLogger = createLogger({ logLevel: compileServerLogLevel })
    const launchLogger = createLogger({ logLevel: launchLogLevel })
    const executeLogger = createLogger({ logLevel: executeLogLevel })
    const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
    const compileDirectoryUrl = resolveDirectoryUrl(
      compileDirectoryRelativePath,
      projectDirectoryUrl,
    )

    const result = await executePlan({
      cancellationToken,
      logger,
      plan: testPlan,
      compileServerLogger,
      launchLogger,
      executeLogger,
      projectDirectoryUrl,
      compileDirectoryUrl,
      ...rest,
    })

    if (updateProcessExitCode && !executionIsPassed(result)) {
      process.exitCode = 1
    }

    const promises = []
    if (coverageJsonFile) {
      promises.push(
        generateCoverageJsonFile({
          projectDirectoryUrl,
          coverageJsonFileRelativePath,
          coverageJsonFileLog,
          coverageMap: result.coverageMap,
        }),
      )
    }
    if (coverageHtmlDirectory) {
      promises.push(
        generateCoverageHtmlDirectory({
          coverageMap: result.coverageMap,
          projectDirectoryUrl,
          coverageHtmlDirectoryRelativePath,
          coverageHtmlDirectoryIndexLog,
        }),
      )
    }
    if (coverageConsole) {
      promises.push(
        generateCoverageConsoleReport({
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
