import { createControlledProcess } from "./controlled_process.js"

export const nodeProcess = {
  name: "node",
  version: process.version.slice(1),
}

nodeProcess.run = async ({
  signal = new AbortController().signal,
  logger,
  logProcessCommand,
  fileUrl,

  measurePerformance,
  collectPerformance,
  collectCoverage = false,
  coverageForceIstanbul,
  coverageConfig,

  stoppedCallbackList,
  errorCallbackList,
  outputCallbackList,
  stopAfterExecute = false,
  stopAfterExecuteReason = "",
  gracefulStopAllocatedMs = 4000,

  debugPort,
  debugMode,
  debugModeInheritBreak,
  env,
  inheritProcessEnv,
  commandLineOptions = [],
  stdin,
  stdout,
  stderr,
}) => {
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
  const { stop, requestActionOnChildProcess } = await createControlledProcess({
    signal,
    logger,
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

    stoppedCallbackList,
    errorCallbackList,
    outputCallbackList,
  })
  signal.addEventListener("abort", stop)
  const namespace = await requestActionOnChildProcess({
    signal,
    actionType: "execute-using-dynamic-import",
    actionParams: {
      fileUrl: String(fileUrl),
      measurePerformance,
      collectPerformance,
      collectCoverage,
      coverageConfig,
    },
  })
  signal.removeEventListener("abort", stop)
  if (stopAfterExecute) {
    logger.debug(`stop node process because ${stopAfterExecuteReason}`)
    const { graceful } = await stop({
      reason: stopAfterExecuteReason,
      gracefulStopAllocatedMs,
    })
    if (graceful) {
      logger.debug(`node process stopped gracefully`)
    } else {
      logger.debug(`node process stopped`)
    }
  } else {
    // node process is kept alive after execution
    errorCallbackList.add((error) => {
      throw error
    })
    stoppedCallbackList.add(() => {
      logger.debug(`node stopped after execution`)
    })
  }
  return {
    status: "completed",
    namespace,
  }
}
