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

  keepRunning,
  gracefulStopAllocatedMs = 4000,
  stopSignal,
  onStop,
  onError,
  onConsole,
  onResult,

  measurePerformance,
  collectPerformance,
  collectCoverage = false,
  coverageForceIstanbul,

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

    stopSignal,
    onStop,
    onError,
    onConsole,
  })
  const namespace = await requestActionOnChildProcess({
    signal,
    actionType: "execute-using-dynamic-import",
    actionParams: {
      fileUrl: String(fileUrl),
      measurePerformance,
      collectPerformance,
      collectCoverage,
    },
  })
  onResult({
    status: "completed",
    namespace,
  })
  if (keepRunning) {
    stopSignal.notify = stop
    return
  }
  await stop({
    gracefulStopAllocatedMs,
  })
}
