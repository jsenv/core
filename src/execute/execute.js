/*
 * Export a function capable to execute a file on a runtime (browser or node) and return how it goes.
 *
 * - can be useful to execute a file in a browser/node.js programmatically
 * - not documented
 * - the most importants parts:
 *   - fileRelativeUrl: the file to execute inside rootDirectoryUrl
 *   - runtime: an object with a "run" method.
 *   The run method will start a browser/node process and execute file in it
 * - Most of the logic lives in "./run.js" used by executeTestPlan to run tests
 */

import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
import { createLogger } from "@jsenv/log"

import { assertAndNormalizeWebServer } from "./web_server_param.js"
import { run } from "./run.js"

export const execute = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel,
  rootDirectoryUrl,
  webServer,

  fileRelativeUrl,
  allocatedMs,
  mirrorConsole = true,
  keepRunning = false,

  collectConsole,
  collectCoverage,
  coverageTempDirectoryUrl,
  collectPerformance = false,
  runtime,
  runtimeParams,

  ignoreError = false,
}) => {
  const logger = createLogger({ logLevel })
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(
    rootDirectoryUrl,
    "rootDirectoryUrl",
  )
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

  if (runtime.type === "browser") {
    await assertAndNormalizeWebServer(webServer)
  }

  let resultTransformer = (result) => result
  runtimeParams = {
    rootDirectoryUrl,
    webServer,
    fileRelativeUrl,
    ...runtimeParams,
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
    if (result.status === "failed") {
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
      throw result.errors[result.errors.length - 1]
    }
    return result
  } finally {
    await executeOperation.end()
  }
}
