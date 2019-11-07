/* eslint-disable import/max-dependencies */
import {
  catchAsyncFunctionCancellation,
  createProcessInterruptionCancellationToken,
} from "@dmail/cancellation"
import { metaMapToSpecifierMetaMap, normalizeSpecifierMetaMap, urlToMeta } from "@jsenv/url-meta"
import { collectFiles } from "@jsenv/file-collector"
import { pathToDirectoryUrl, resolveDirectoryUrl, fileUrlToPath } from "../urlUtils.js"
import { startCompileServerForTesting } from "./startCompileServerForTesting.js"
import { executionResultToCoverageMap } from "./coverage/executionResultToCoverageMap.js"
import { createInstrumentBabelPlugin } from "./coverage/instrument-babel-plugin.js"
import { relativePathToEmptyCoverage } from "./coverage/relativePathToEmptyCoverage.js"
import { generateCoverageJsonReport } from "./coverage/generateCoverageJsonReport.js"
import { generateCoverageHtmlReport } from "./coverage/generateCoverageHtmlReport.js"
import { generateCoverageConsoleReport } from "./coverage/generateCoverageConsoleReport.js"
import { generateExecutionArray } from "./execution/generate-execution-array.js"
import { executeAll } from "./execution/execute-all.js"
import { executionIsPassed } from "./execution/execution-is-passed.js"

export const cover = async ({
  logLevel,
  compileServerLogLevel = "off",
  launchLogLevel = "off",
  executeLogLevel = "off",
  projectDirectoryPath,
  compileDirectoryRelativePath = "./.dist",
  importMapFileRelativePath,
  importDefaultExtension,
  coverageJsonFile = true,
  coverageJsonFileLog = true,
  coverageJsonFileRelativePath = "./coverage/coverage-final.json",
  coverageConsole = false,
  coverageHtmlDirectory = false,
  coverageHtmlDirectoryRelativePath = "./coverage",
  coverageHtmlDirectoryIndexLog = true,
  executeDescription = {},
  // coverDescription could be deduced from passing
  // an entryPointMap and collecting all dependencies
  // for now we stick to coverDescription using @jsenv/meta-url api
  coverDescription = {
    "./index.js": true,
    "./src/**/*.js": true,
    "./**/*.test.*": false, // contains .test. -> nope
    "./**/test/": false, // inside a test folder -> nope,
  },
  babelPluginMap = {},
  convertMap,
  compileGroupCount = 2,
  updateProcessExitCode = true,
  throwUnhandled = true,
  maxParallelExecution,
  defaultAllocatedMsPerExecution = 30000,
  captureConsole = true,
  measureDuration = true,
  measureTotalDuration = false,
  collectNamespace = false,
  generateMissedCoverage = true,
  executionAndCoverageAllowed = false,
  cleanCompileInto,
}) => {
  if (typeof coverDescription !== "object") {
    throw new TypeError(`coverDescription must be an object, got ${coverDescription}`)
  }
  if (Object.keys(coverDescription).length === 0) {
    console.warn(
      `coverDescription is an empty object. Nothing will be instrumented for coverage so your coverage will be empty`,
    )
  }

  const start = async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()
    const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
    const compileDirectoryUrl = resolveDirectoryUrl(
      compileDirectoryRelativePath,
      projectDirectoryUrl,
    )

    const specifierMetaMapForCoverage = normalizeSpecifierMetaMap(
      metaMapToSpecifierMetaMap({
        cover: coverDescription,
      }),
      projectDirectoryUrl,
    )

    const coverRelativePathPredicate = (relativePath) =>
      urlToMeta({
        url: `${projectDirectoryUrl}${relativePath}`,
        specifierMetaMap: specifierMetaMapForCoverage,
      }).cover === true

    if (!executionAndCoverageAllowed) {
      ensureNoFileIsBothCoveredAndExecuted({ executeDescription, coverRelativePathPredicate })
    }

    const [executionResult, relativePathToCoverArray] = await Promise.all([
      (async () => {
        const [executionArray, { origin: compileServerOrigin }] = await Promise.all([
          generateExecutionArray(executeDescription, {
            cancellationToken,
            projectDirectoryUrl,
          }),
          startCompileServerForTesting({
            cancellationToken,
            projectDirectoryUrl,
            compileDirectoryUrl,
            importMapFileRelativePath,
            importDefaultExtension,
            compileGroupCount,
            babelPluginMap: {
              ...babelPluginMap,
              "transform-instrument": [
                createInstrumentBabelPlugin({
                  predicate: ({ relativePath }) => {
                    return coverRelativePathPredicate(relativePath)
                  },
                }),
              ],
            },
            convertMap,
            logLevel: compileServerLogLevel,
            cleanCompileInto,
          }),
        ])

        return executeAll(executionArray, {
          cancellationToken,
          compileServerOrigin,
          projectDirectoryUrl,
          compileDirectoryUrl,
          importMapFileRelativePath,
          importDefaultExtension,
          logLevel,
          launchLogLevel,
          executeLogLevel,
          maxParallelExecution,
          defaultAllocatedMsPerExecution,
          captureConsole,
          measureDuration,
          measureTotalDuration,
          collectNamespace,
          collectCoverage: true,
        })
      })(),
      listRelativePathToCover({
        cancellationToken,
        projectDirectoryUrl,
        coverDescription,
      }),
    ])

    const executionCoverageMap = executionResultToCoverageMap(executionResult)
    const relativePathMissingCoverageArray = relativePathToCoverArray.filter(
      (relativePathToCover) => relativePathToCover.slice(1) in executionCoverageMap === false,
    )

    let coverageMap
    if (generateMissedCoverage) {
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

    if (updateProcessExitCode && !executionIsPassed(executionResult)) {
      process.exitCode = 1
    }

    if (coverageJsonFile) {
      await generateCoverageJsonReport({
        projectDirectoryUrl,
        coverageJsonFileRelativePath,
        coverageJsonFileLog,
        coverageMap,
      })
    }
    if (coverageHtmlDirectory) {
      await generateCoverageHtmlReport({
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

    return {
      coverageMap,
      executionResult,
    }
  }

  const promise = catchAsyncFunctionCancellation(start)
  if (!throwUnhandled) return promise
  return promise.catch((e) => {
    setTimeout(() => {
      throw e
    })
  })
}

const ensureNoFileIsBothCoveredAndExecuted = ({
  executeDescription,
  coverRelativePathPredicate,
}) => {
  const fileToExecuteAndCoverArray = Object.keys(executeDescription).filter((relativePath) =>
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
  coverDescription,
}) => {
  const specifierMetaMapForCoverage = metaMapToSpecifierMetaMap({
    cover: coverDescription,
  })

  const matchingFileResultArray = await collectFiles({
    cancellationToken,
    directoryPath: fileUrlToPath(projectDirectoryPath),
    specifierMetaMap: specifierMetaMapForCoverage,
    predicate: ({ cover }) => cover,
  })

  const relativePathToCoverArray = matchingFileResultArray.map(({ relativePath }) => relativePath)
  return relativePathToCoverArray
}
