import { Script } from "node:vm"
import { loggerToLogLevel } from "@jsenv/logger"

import { createControllableNodeProcess } from "./node_controllable_process.js"

export const nodeProcess = {
  name: "node",
  version: process.version.slice(1),
}

nodeProcess.launch = async (
  signal = new AbortController().signal,
  logger,
  logProcessCommand,

  projectDirectoryUrl,
  compileServerId,
  compileServerOrigin,
  jsenvDirectoryRelativeUrl,

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
) => {
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

      fileRelativeUrl,
      executionId,
      exitAfterAction: stopAfterExecute,

      measurePerformance,
      collectPerformance,
      collectCoverage,
      coverageConfig,
    }
    const executionResult = await requestActionOnChildProcess({
      signal,
      actionType: "execute-using-dynamic-import",
      actionParams: executeParams,
    })
    const { status } = executionResult
    if (status === "errored") {
      const { exceptionSource, ...rest } = executionResult
      const error = evalSource(exceptionSource)
      return {
        status,
        error,
        ...rest,
      }
    }
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

const evalSource = (code, href) => {
  const script = new Script(code, { filename: href })
  return script.runInThisContext()
}
