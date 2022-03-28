import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"

import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import { createUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"
import { getJsenvPlugins } from "@jsenv/core/src/omega/jsenv_plugins.js"
import { startOmegaServer } from "@jsenv/core/src/omega/server.js"

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

  plugins = [],
  scenario = "dev",
  sourcemaps = "inline",

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
      plugins: [...plugins, ...getJsenvPlugins()],
      scenario,
      sourcemaps,
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
  }

  const result = await run({
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
