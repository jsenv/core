import {
  createCancellationToken,
  composeCancellationToken,
} from "@jsenv/cancellation"

import { executeJsenvAsyncFunction } from "./internal/executeJsenvAsyncFunction.js"
import {
  assertProjectDirectoryUrl,
  assertProjectDirectoryExists,
} from "./internal/argUtils.js"
import { startCompileServer } from "./internal/compiling/startCompileServer.js"
import { launchAndExecute } from "./internal/executing/launchAndExecute.js"
import {
  PLAYWRIGHT_CHROMIUM_VERSION,
  PLAYWRIGHT_FIREFOX_VERSION,
  PLAYWRIGHT_WEBKIT_VERSION,
} from "./playwright_browser_versions.js"

export const execute = async ({
  logLevel = "warn",
  compileServerLogLevel = logLevel,
  launchAndExecuteLogLevel = logLevel,
  cancellationToken = createCancellationToken(),
  cancelOnSIGINT = true,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,

  importDefaultExtension,

  fileRelativeUrl,
  launch,
  launchParams,

  allocatedMs,
  measureDuration,
  mirrorConsole = true,
  captureConsole,
  collectRuntimeName,
  collectRuntimeVersion,
  inheritCoverage,
  collectCoverage,
  measurePerformance,
  collectPerformance,
  stopAfterExecute = false,
  stopAfterExecuteReason,
  gracefulStopAllocatedMs,
  ignoreError = false,

  compileServerProtocol,
  compileServerPrivateKey,
  compileServerCertificate,
  compileServerIp,
  compileServerPort,
  babelPluginMap,
  convertMap,
  compileGroupCount,
  compileServerCanReadFromFilesystem,
  compileServerCanWriteOnFilesystem,
  runtimeSupport = {
    chrome: PLAYWRIGHT_CHROMIUM_VERSION,
    firefox: PLAYWRIGHT_FIREFOX_VERSION,
    safari: PLAYWRIGHT_WEBKIT_VERSION,
    node: process.version.slice(1),
  },
  runtimeSupportIsExhaustive = true,
  runtimeWillAlwaysBeKnown = true,
}) => {
  const jsenvExecutionFunction = async ({ jsenvCancellationToken }) => {
    cancellationToken = composeCancellationToken(
      cancellationToken,
      jsenvCancellationToken,
    )

    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    if (typeof fileRelativeUrl !== "string") {
      throw new TypeError(
        `fileRelativeUrl must be a string, got ${fileRelativeUrl}`,
      )
    }
    fileRelativeUrl = fileRelativeUrl.replace(/\\/g, "/")
    if (typeof launch !== "function") {
      throw new TypeError(`launch must be a function, got ${launch}`)
    }

    const {
      outDirectoryRelativeUrl,
      origin: compileServerOrigin,
      stop,
    } = await startCompileServer({
      cancellationToken,
      compileServerLogLevel,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      outDirectoryName: "out-execute",

      importDefaultExtension,

      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      babelPluginMap,
      convertMap,
      compileGroupCount,
      runtimeSupport,
      runtimeSupportIsExhaustive,
      runtimeWillAlwaysBeKnown,
      compileServerCanReadFromFilesystem,
      compileServerCanWriteOnFilesystem,
    })

    const result = await launchAndExecute({
      launchAndExecuteLogLevel,
      cancellationToken,

      launch,
      launchParams: {
        projectDirectoryUrl,
        compileServerOrigin,
        outDirectoryRelativeUrl,
        ...launchParams,
      },
      executeParams: {
        fileRelativeUrl,
      },

      allocatedMs,
      measureDuration,
      mirrorConsole,
      captureConsole,
      collectRuntimeName,
      collectRuntimeVersion,
      inheritCoverage,
      collectCoverage,
      measurePerformance,
      collectPerformance,

      stopAfterExecute,
      stopAfterExecuteReason,
      gracefulStopAllocatedMs,
    })

    stop("single-execution-done")

    return result
  }

  const executionPromise = executeJsenvAsyncFunction(jsenvExecutionFunction, {
    cancelOnSIGINT,
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
