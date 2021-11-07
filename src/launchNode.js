import { Script } from "node:vm"
import { loggerToLogLevel } from "@jsenv/logger"

import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { escapeRegexpSpecialCharacters } from "./internal/escapeRegexpSpecialCharacters.js"
import { createControllableNodeProcess } from "./internal/node-launcher/createControllableNodeProcess.js"

export const nodeRuntime = {
  name: "node",
  version: process.version.slice(1),
}
nodeRuntime.launch = async ({
  signal = new AbortController().signal,
  logger,
  logProcessCommand,

  projectDirectoryUrl,
  compileServerOrigin,
  outDirectoryRelativeUrl,

  measurePerformance,
  collectPerformance,
  collectCoverage = false,
  coverageForceIstanbul,
  coverageConfig,

  debugPort,
  debugMode,
  debugModeInheritBreak,
  env,
  inheritProcessEnv,
  commandLineOptions = [],
  stdin,
  stdout,
  stderr,
  stopAfterExecute,
  canUseNativeModuleSystem,

  remap = true,
}) => {
  if (typeof projectDirectoryUrl !== "string") {
    throw new TypeError(
      `projectDirectoryUrl must be a string, got ${projectDirectoryUrl}`,
    )
  }
  if (typeof compileServerOrigin !== "string") {
    throw new TypeError(
      `compileServerOrigin must be a string, got ${compileServerOrigin}`,
    )
  }
  if (typeof outDirectoryRelativeUrl !== "string") {
    throw new TypeError(
      `outDirectoryRelativeUrl must be a string, got ${outDirectoryRelativeUrl}`,
    )
  }

  env = {
    ...env,
    COVERAGE_ENABLED: collectCoverage,
    JSENV: true,
  }

  if (coverageForceIstanbul) {
    // if we want to force istanbul, we will set process.env.NODE_V8_COVERAGE = ''
    // into the child_process
    env.NODE_V8_COVERAGE = ""
  }

  commandLineOptions = [
    "--experimental-import-meta-resolve",
    ...commandLineOptions,
  ]

  const logLevel = loggerToLogLevel(logger)
  const {
    execArgv,
    stoppedCallbackList,
    errorCallbackList,
    outputCallbackList,
    stop,
    requestActionOnChildProcess,
  } = await createControllableNodeProcess({
    signal,
    logLevel,
    debugPort,
    debugMode,
    debugModeInheritBreak,
    env,
    inheritProcessEnv,
    commandLineOptions,
    stdin,
    stdout,
    stderr,
    logProcessCommand,
  })

  const execute = async ({ signal, fileRelativeUrl, executionId }) => {
    const executeParams = {
      projectDirectoryUrl,
      compileServerOrigin,
      outDirectoryRelativeUrl,
      jsenvCoreDirectoryUrl,

      fileRelativeUrl,
      executionId,
      canUseNativeModuleSystem,
      exitAfterAction: stopAfterExecute,

      measurePerformance,
      collectPerformance,
      collectCoverage,
      coverageConfig,

      remap,
    }

    let executionResult = await requestActionOnChildProcess({
      signal,
      actionType: "execute-using-dynamic-import-fallback-on-systemjs",
      actionParams: executeParams,
    })

    executionResult = transformExecutionResult(executionResult, {
      compileServerOrigin,
      projectDirectoryUrl,
    })

    return executionResult
  }

  return {
    options: {
      execArgv,
      // for now do not pass env, it make debug logs to verbose
      // because process.env is very big
      // env,
    },
    stoppedCallbackList,
    errorCallbackList,
    outputCallbackList,
    stop,
    execute,
  }
}

const transformExecutionResult = (
  executionResult,
  { compileServerOrigin, projectDirectoryUrl },
) => {
  const { status } = executionResult

  if (status === "errored") {
    const { exceptionSource, ...rest } = executionResult
    const error = evalSource(exceptionSource)
    const errorTransformed = transformError(error, {
      compileServerOrigin,
      projectDirectoryUrl,
    })
    return {
      status,
      error: errorTransformed,
      ...rest,
    }
  }

  return executionResult
}

const transformError = (
  error,
  { compileServerOrigin, projectDirectoryUrl },
) => {
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
  error.message = error.message.replace(
    compileServerOriginRegexp,
    projectDirectoryUrl,
  )
  error.stack = error.stack.replace(
    compileServerOriginRegexp,
    projectDirectoryUrl,
  )
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
