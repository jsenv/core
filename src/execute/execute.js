import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"

import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import { getCorePlugins } from "@jsenv/core/src/plugins/plugins.js"
import { createUrlGraph } from "@jsenv/core/src/omega/url_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen.js"
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
  collectConsole,
  collectCoverage,
  coverageTempDirectoryUrl,
  runtime,
  runtimeParams,

  scenario = "dev",
  sourcemaps = "inline",
  plugins = [],
  nodeEsmResolution,
  fileSystemMagicResolution,
  injectedGlobals,
  transpilation,

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
    const urlGraph = createUrlGraph()
    const kitchen = createKitchen({
      signal,
      logger,
      rootDirectoryUrl,
      urlGraph,
      scenario,
      sourcemaps,
      plugins: [
        ...plugins,
        ...getCorePlugins({
          scenario,
          nodeEsmResolution,
          fileSystemMagicResolution,
          injectedGlobals,
          transpilation,
        }),
      ],
    })
    const serverLogger = createLogger({ logLevel: "warn" })
    const server = await startOmegaServer({
      signal: executeOperation.signal,
      logger: serverLogger,
      rootDirectoryUrl,
      urlGraph,
      kitchen,
      scenario,
      keepProcessAlive: false,
      port,
      protocol,
      http2,
      certificate,
      privateKey,
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
