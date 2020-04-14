import { catchCancellation, createCancellationTokenForProcess } from "@jsenv/util"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "./internal/argUtils.js"
import { startCompileServer } from "./internal/compiling/startCompileServer.js"
import { launchAndExecute } from "./internal/executing/launchAndExecute.js"

export const execute = async ({
  cancellationToken = createCancellationTokenForProcess(),
  logLevel = "warn",
  compileServerLogLevel = logLevel,
  executionLogLevel = logLevel,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  fileRelativeUrl,

  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap,
  convertMap,
  compileGroupCount = 2,

  launch,
  mirrorConsole = true,
  stopAfterExecute = false,
  gracefulStopAllocatedMs,
  ignoreError = false,
  ...rest
}) => {
  const executionPromise = catchCancellation(async () => {
    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    if (typeof fileRelativeUrl !== "string") {
      throw new TypeError(`fileRelativeUrl must be a string, got ${fileRelativeUrl}`)
    }
    fileRelativeUrl = fileRelativeUrl.replace(/\\/g, "/")
    if (typeof launch !== "function") {
      throw new TypeError(`launch must be a function, got ${launch}`)
    }

    const { outDirectoryRelativeUrl, origin: compileServerOrigin, stop } = await startCompileServer(
      {
        cancellationToken,
        compileServerLogLevel,

        projectDirectoryUrl,
        jsenvDirectoryRelativeUrl,
        jsenvDirectoryClean,
        importMapFileRelativeUrl,
        importDefaultExtension,

        compileServerProtocol,
        compileServerPrivateKey,
        compileServerCertificate,
        compileServerIp,
        compileServerPort,
        babelPluginMap,
        convertMap,
        compileGroupCount,
      },
    )

    const result = await launchAndExecute({
      cancellationToken,
      executionLogLevel,

      fileRelativeUrl,
      launch: (params) =>
        launch({
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin,
          ...params,
        }),
      mirrorConsole,
      stopAfterExecute,
      gracefulStopAllocatedMs,
      ...rest,
    })

    stop("execution-done")

    return result
  }).catch((e) => {
    // unexpected internal error
    // -> always updates process.exitCode because we can't trust unhandled rejection
    // to do this
    process.exitCode = 1
    throw e
  })

  if (ignoreError) {
    return executionPromise
  }

  const result = await executionPromise
  if (result.status === "errored") {
    /*
    Warning: when node launched with --unhandled-rejections=strict, despites
    this promise being rejected by throw result.error node will compltely ignore it.

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
}
