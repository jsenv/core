/* eslint-disable import/max-dependencies */
import { Script } from "vm"

import { loggerToLogLevel } from "@jsenv/logger"
import { createCancellationToken } from "@jsenv/cancellation"
import { writeDirectory, resolveUrl, urlToFileSystemPath, removeFileSystemNode } from "@jsenv/util"

import { require } from "@jsenv/core/src/internal/require.js"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { escapeRegexpSpecialCharacters } from "./internal/escapeRegexpSpecialCharacters.js"
import { createControllableNodeProcess } from "./internal/node-launcher/createControllableNodeProcess.js"
import { istanbulCoverageFromV8Coverage } from "./internal/executing/coverage/istanbulCoverageFromV8Coverage.js"

const cuid = require("cuid")

export const launchNode = async ({
  cancellationToken = createCancellationToken(),
  logger,

  projectDirectoryUrl,
  outDirectoryRelativeUrl,
  compileServerOrigin,

  debugPort,
  debugMode,
  debugModeInheritBreak,
  env,
  commandLineOptions = [],
  stdin,
  stdout,
  stderr,

  remap = true,
  collectCoverage = false,
  coverageConfig,
  coverageForceIstanbul = false,
  logProcessCommand,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(`projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`)
  }
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(`compileServerOrigin must be a string, got ${compileServerOrigin}`)
  }
  if (typeof outDirectoryRelativeUrl !== "string") {
    throw new TypeError(`outDirectoryRelativeUrl must be a string, got ${outDirectoryRelativeUrl}`)
  }

  env = {
    ...(env ? env : process.env),
    COVERAGE_ENABLED: collectCoverage,
    JSENV: true,
  }

  let finalizeExecutionResult

  if (collectCoverage && !coverageForceIstanbul) {
    const NODE_V8_COVERAGE = await getNodeV8CoverageDir({ projectDirectoryUrl })
    env.NODE_V8_COVERAGE = NODE_V8_COVERAGE

    // the v8 coverage directory is available once the child process is disconnected
    finalizeExecutionResult = async (executionResult) => {
      const coverageMap = await ensureV8CoverageDirRemoval(async () => {
        // prefer istanbul if available
        if (executionResult.coverageMap) {
          return executionResult.coverageMap
        }

        await controllableNodeProcess.disconnected
        const istanbulCoverage = await istanbulCoverageFromV8Coverage({
          projectDirectoryUrl,
          NODE_V8_COVERAGE,
          coverageConfig,
        })
        return istanbulCoverage
      }, NODE_V8_COVERAGE)
      executionResult.coverageMap = coverageMap
      return executionResult
    }
  }

  commandLineOptions = ["--experimental-import-meta-resolve", ...commandLineOptions]

  const logLevel = loggerToLogLevel(logger)
  const controllableNodeProcess = await createControllableNodeProcess({
    cancellationToken,
    logLevel,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    env,
    commandLineOptions,
    stdin,
    stdout,
    stderr,
    logProcessCommand,
  })

  const executeFile = async (fileRelativeUrl, { collectCoverage, executionId }) => {
    const executeParams = {
      jsenvCoreDirectoryUrl,
      projectDirectoryUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,

      fileRelativeUrl,
      collectCoverage,
      coverageConfig,
      executionId,
      remap,
    }

    let executionResult = await controllableNodeProcess.requestActionOnChildProcess({
      actionType: "execute-using-systemjs",
      actionParams: executeParams,
    })

    executionResult = transformExecutionResult(executionResult, {
      compileServerOrigin,
      projectDirectoryUrl,
    })

    return executionResult
  }

  return {
    name: "node",
    version: process.version.slice(1),
    options: {
      execArgv: controllableNodeProcess.execArgv,
      // for now do not pass env, it make debug logs to verbose
      // because process.env is very big
      // env,
    },
    gracefulStop: controllableNodeProcess.gracefulStop,
    stop: controllableNodeProcess.stop,
    disconnected: controllableNodeProcess.disconnected,
    registerErrorCallback: controllableNodeProcess.registerErrorCallback,
    registerConsoleCallback: controllableNodeProcess.registerConsoleCallback,
    executeFile,
    finalizeExecutionResult,
  }
}

const ensureV8CoverageDirRemoval = async (fn, NODE_V8_COVERAGE) => {
  try {
    return await fn()
  } finally {
    removeFileSystemNode(NODE_V8_COVERAGE, {
      recursive: true,
    })
  }
}

const getNodeV8CoverageDir = async ({ projectDirectoryUrl }) => {
  const v8CoverageDirectory = resolveUrl(`./coverage-v8/${cuid()}`, projectDirectoryUrl)
  await writeDirectory(v8CoverageDirectory, { allowUseless: true })
  return urlToFileSystemPath(v8CoverageDirectory)
}

const transformExecutionResult = (evaluateResult, { compileServerOrigin, projectDirectoryUrl }) => {
  const { status } = evaluateResult

  if (status === "errored") {
    const { exceptionSource, coverageMap } = evaluateResult
    const error = evalSource(exceptionSource)
    const errorTransformed = transformError(error, { compileServerOrigin, projectDirectoryUrl })
    return {
      status,
      error: errorTransformed,
      coverageMap,
    }
  }

  const { namespace, coverageMap } = evaluateResult
  return {
    status,
    namespace,
    coverageMap,
  }
}

const transformError = (error, { compileServerOrigin, projectDirectoryUrl }) => {
  if (!error) {
    return error
  }

  if (!(error instanceof Error)) {
    return error
  }

  const compileServerOriginRegexp = new RegExp(
    escapeRegexpSpecialCharacters(`${compileServerOrigin}/`),
    "g",
  )
  // const serverUrlRegExp = new RegExp(
  //   `(${escapeRegexpSpecialCharacters(`${compileServerOrigin}/`)}[^\\s]+)`,
  //   "g",
  // )
  error.message = error.message.replace(compileServerOriginRegexp, projectDirectoryUrl)
  error.stack = error.stack.replace(compileServerOriginRegexp, projectDirectoryUrl)
  // const projectDirectoryPath = urlToFileSystemPath(projectDirectoryUrl)
  // const projectDirectoryPathRegexp = new RegExp(
  //   `(?<!file:\/\/)${escapeRegexpSpecialCharacters(projectDirectoryPath)}`,
  //   "g",
  // )
  // error.stack = error.stack.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
  // error.message = error.message.replace(projectDirectoryPathRegexp, projectDirectoryUrl)
  return error
}

const evalSource = (code, href) => {
  const script = new Script(code, { filename: href })
  return script.runInThisContext()
}
