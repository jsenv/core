import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"

import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
import { createLogger } from "@jsenv/log"

import { startOmegaServer } from "@jsenv/core/src/omega/omega_server.js"
import { run } from "./run.js"

export const execute = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel,
  rootDirectoryUrl,

  fileRelativeUrl,
  allocatedMs,
  mirrorConsole = true,
  keepRunning = false,
  services,
  collectConsole,
  collectCoverage,
  coverageTempDirectoryUrl,
  collectPerformance = false,
  runtime,
  runtimeParams,

  scenario = "dev",
  plugins = [],
  nodeEsmResolution,
  fileSystemMagicResolution,
  transpilation,
  htmlSupervisor = true,
  sourcemaps = "inline",
  writeGeneratedFiles = false,

  port,
  protocol,
  http2,
  certificate,
  privateKey,

  ignoreError = false,
}) => {
  const logger = createLogger({ logLevel })
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  const executeOperation = Abort.startOperation()
  executeOperation.addAbortSignal(signal)
  if (handleSIGINT) {
    executeOperation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      )
    })
  }

  let resultTransformer = (result) => result
  runtimeParams = {
    rootDirectoryUrl,
    fileRelativeUrl,
    ...runtimeParams,
  }
  if (runtime.needsServer) {
    const server = await startOmegaServer({
      signal: executeOperation.signal,
      logLevel: "warn",
      keepProcessAlive: false,
      services,
      port,
      protocol,
      http2,
      certificate,
      privateKey,

      rootDirectoryUrl,
      scenario,
      runtimeCompat: { [runtime.name]: runtime.version },

      plugins,

      htmlSupervisor,
      nodeEsmResolution,
      fileSystemMagicResolution,
      transpilation,
      sourcemaps,
      writeGeneratedFiles,
    })
    executeOperation.addEndCallback(async () => {
      await server.stop("execution done")
    })
    runtimeParams = {
      ...runtimeParams,
      server,
    }
    resultTransformer = (result) => {
      result.server = server
      return result
    }
  }

  let result = await run({
    signal: executeOperation.signal,
    logger,
    allocatedMs,
    keepRunning,
    mirrorConsole,
    collectConsole,
    collectCoverage,
    coverageTempDirectoryUrl,
    collectPerformance,
    runtime,
    runtimeParams,
  })
  result = resultTransformer(result)

  try {
    if (result.status === "errored") {
      if (ignoreError) {
        return result
      }
      /*
  Warning: when node launched with --unhandled-rejections=strict, despites
  this promise being rejected by throw result.error node will completely ignore it.

  The error can be logged by doing
  ```js
  process.setUncaughtExceptionCaptureCallback((error) => {
    console.error(error.stack)
  })
  ```
  But it feels like a hack.
  */
      throw result.error
    }
    return result
  } finally {
    await executeOperation.end()
  }
}
