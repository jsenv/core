/* eslint-disable import/max-dependencies */
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "@dmail/cancellation"
import { createLogger } from "@jsenv/logger"
import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { collectFiles } from "@jsenv/file-collector"
import { pathToDirectoryUrl, resolveDirectoryUrl, fileUrlToPath } from "./private/urlUtils.js"

import { startCompileServerForTesting } from "./private/test-execution/startCompileServerForTesting.js"
import { generateExecutionArray } from "./private/test-execution/generateExecutionArray.js"
import { executeAll } from "./private/test-execution/executeAll.js"
import { executionIsPassed } from "./private/test-execution/executionIsPassed.js"

import { relativePathToEmptyCoverage } from "./private/coverage/relativePathToEmptyCoverage.js"
import { executionResultToCoverageMap } from "./private/coverage/executionResultToCoverageMap.js"
import { generateCoverageJsonFile } from "./private/coverage/generateCoverageJsonFile.js"
import { generateCoverageHtmlDirectory } from "./private/coverage/generateCoverageHtmlDirectory.js"
import { generateCoverageConsoleReport } from "./private/coverage/generateCoverageConsoleReport.js"
import { createInstrumentBabelPlugin } from "./private/coverage/createInstrumentBabelPlugin.js"

export const executeTests = async ({
  logLevel,
  compileServerLogLevel = "off",
  launchLogLevel = "off",
  executeLogLevel = "off",
  projectDirectoryPath,
  compileDirectoryRelativePath = "./.dist/",
  compileDirectoryClean,
  importMapFileRelativePath,
  importDefaultExtension,
  compileGroupCount = 2,
  babelPluginMap,
  convertMap,
  updateProcessExitCode = true,
  throwUnhandled = true,

  // execution parameters
  executionConfig = {},
  captureConsole = true,
  measureDuration = true,
  measureTotalDuration = false,
  collectNamespace = false,
  maxParallelExecution,
  defaultAllocatedMsPerExecution = 30000,

  // coverage parameters
  coverage = false,
  coverageConfig = {
    "./index.js": true,
    "./src/**/*.js": true,
    "./**/*.test.*": false, // contains .test. -> nope
    "./**/test/": false, // inside a test folder -> nope,
  },
  coverageIncludeMissing = true,
  coverageJsonFile = true,
  coverageJsonFileLog = true,
  coverageJsonFileRelativePath = "./coverage/coverage-final.json",
  coverageConsole = false,
  coverageHtmlDirectory = false,
  coverageHtmlDirectoryRelativePath = "./coverage",
  coverageHtmlDirectoryIndexLog = true,
  coverageAndExecutionAllowed = false,
}) => {
  const start = async () => {
    const logger = createLogger({ logLevel })
    const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
    const compileDirectoryUrl = resolveDirectoryUrl(
      compileDirectoryRelativePath,
      projectDirectoryUrl,
    )
    const cancellationToken = createProcessInterruptionCancellationToken()

    const computeExecutionResult = async () => {
      const [executionArray, { origin: compileServerOrigin }] = await Promise.all([
        generateExecutionArray(executionConfig, {
          cancellationToken,
          projectDirectoryUrl,
        }),
        startCompileServerForTesting({
          cancellationToken,
          logLevel: compileServerLogLevel,
          projectDirectoryUrl,
          compileDirectoryUrl,
          compileDirectoryClean,
          importMapFileRelativePath,
          importDefaultExtension,
          compileGroupCount,
          babelPluginMap,
          convertMap,
        }),
      ])

      const executionResult = await executeAll(executionArray, {
        cancellationToken,
        logLevel,
        compileServerOrigin,
        projectDirectoryUrl,
        compileDirectoryUrl,
        importMapFileRelativePath,
        importDefaultExtension,
        launchLogLevel,
        executeLogLevel,
        maxParallelExecution,
        defaultAllocatedMsPerExecution,
        captureConsole,
        measureDuration,
        measureTotalDuration,
        collectNamespace,
        collectCoverage: coverage,
      })

      if (updateProcessExitCode && !executionIsPassed(executionResult)) {
        process.exitCode = 1
      }

      return executionResult
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

      const specifierMetaMapForCoverage = normalizeSpecifierMetaMap(
        metaMapToSpecifierMetaMap({
          cover: coverageConfig,
        }),
        projectDirectoryUrl,
      )

      const coverRelativePathPredicate = (relativePath) =>
        urlToMeta({
          url: `${projectDirectoryUrl}${relativePath}`,
          specifierMetaMap: specifierMetaMapForCoverage,
        }).cover === true

      if (!coverageAndExecutionAllowed) {
        ensureNoFileIsBothCoveredAndExecuted({ executionConfig, coverRelativePathPredicate })
      }

      babelPluginMap = {
        ...babelPluginMap,
        "transform-instrument": [
          createInstrumentBabelPlugin({
            predicate: ({ relativePath }) => {
              return coverRelativePathPredicate(relativePath)
            },
          }),
        ],
      }
    }

    if (coverage) {
      const [executionResult, relativePathToCoverArray] = await Promise.all([
        computeExecutionResult(),
        listRelativePathToCover({
          cancellationToken,
          projectDirectoryUrl,
          coverageConfig,
        }),
      ])

      const executionCoverageMap = executionResultToCoverageMap(executionResult)
      const relativePathMissingCoverageArray = relativePathToCoverArray.filter(
        (relativePathToCover) => relativePathToCover in executionCoverageMap === false,
      )

      let coverageMap
      if (coverageIncludeMissing) {
        const missedCoverageMap = {}
        await Promise.all(
          relativePathMissingCoverageArray.map(async (relativePathMissingCoverage) => {
            const emptyCoverage = await relativePathToEmptyCoverage({
              cancellationToken,
              projectDirectoryUrl,
              relativePath: relativePathMissingCoverage,
              babelPluginMap,
            })
            missedCoverageMap[relativePathMissingCoverage.slice(1)] = emptyCoverage
            return emptyCoverage
          }),
        )

        coverageMap = {
          ...executionCoverageMap,
          ...missedCoverageMap,
        }
      } else {
        coverageMap = executionCoverageMap
      }

      if (coverageJsonFile) {
        await generateCoverageJsonFile({
          projectDirectoryUrl,
          coverageJsonFileRelativePath,
          coverageJsonFileLog,
          coverageMap,
        })
      }
      if (coverageHtmlDirectory) {
        await generateCoverageHtmlDirectory({
          coverageMap,
          projectDirectoryUrl,
          coverageHtmlDirectoryRelativePath,
          coverageHtmlDirectoryIndexLog,
        })
      }
      if (coverageConsole) {
        await generateCoverageConsoleReport({
          coverageMap,
        })
      }

      return { coverageMap, executionResult }
    }

    const executionResult = await computeExecutionResult()
    return { executionResult }
  }

  const promise = catchAsyncFunctionCancellation(start)
  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}

const ensureNoFileIsBothCoveredAndExecuted = ({ executionConfig, coverRelativePathPredicate }) => {
  const fileToExecuteAndCoverArray = Object.keys(executionConfig).filter((relativePath) =>
    coverRelativePathPredicate(relativePath),
  )
  if (fileToExecuteAndCoverArray.length) {
    // I think it is an error, it would be strange, for a given file
    // to be both covered and executed
    throw new Error(`some file are both covered and executed:
${fileToExecuteAndCoverArray.join("\n")}`)
  }
}

const listRelativePathToCover = async ({
  cancellationToken,
  projectDirectoryPath,
  coverageConfig,
}) => {
  const specifierMetaMapForCoverage = metaMapToSpecifierMetaMap({
    cover: coverageConfig,
  })

  const matchingFileResultArray = await collectFiles({
    cancellationToken,
    directoryPath: fileUrlToPath(projectDirectoryPath),
    specifierMetaMap: specifierMetaMapForCoverage,
    predicate: ({ cover }) => cover,
  })

  return matchingFileResultArray.map(({ relativePath }) => relativePath)
}
