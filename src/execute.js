import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"

import { normalizeRuntimeSupport } from "@jsenv/core/src/internal/generateGroupMap/runtime_support.js"
import {
  assertProjectDirectoryUrl,
  assertProjectDirectoryExists,
} from "./internal/argUtils.js"
import { startCompileServer } from "./internal/compiling/startCompileServer.js"
import { launchAndExecute } from "./internal/executing/launchAndExecute.js"

export const execute = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,

  logLevel = "warn",
  compileServerLogLevel = logLevel,
  launchAndExecuteLogLevel = logLevel,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,

  importDefaultExtension,

  fileRelativeUrl,
  runtime,
  runtimeParams,

  allocatedMs,
  mirrorConsole = true,
  captureConsole,
  inheritCoverage,
  collectCoverage,
  measurePerformance,
  collectPerformance,
  collectCompileServerInfo = false,
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
  customCompilers,
  compileServerCanReadFromFilesystem,
  compileServerCanWriteOnFilesystem,

  runtimeConsoleCallback,
  runtimeStartedCallback,
  runtimeStoppedCallback,
  runtimeErrorAfterExecutionCallback,
  runtimeDisconnectCallback,
}) => {
  projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
  await assertProjectDirectoryExists({ projectDirectoryUrl })

  if (typeof fileRelativeUrl !== "string") {
    throw new TypeError(
      `fileRelativeUrl must be a string, got ${fileRelativeUrl}`,
    )
  }
  fileRelativeUrl = fileRelativeUrl.replace(/\\/g, "/")

  if (typeof runtime !== "object") {
    throw new TypeError(`runtime must be an object, got ${runtime}`)
  }
  if (typeof runtime.launch !== "function") {
    throw new TypeError(
      `runtime.launch must be a function, got ${runtime.launch}`,
    )
  }

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

  try {
    const {
      outDirectoryRelativeUrl,
      origin: compileServerOrigin,
      stop,
    } = await startCompileServer({
      signal: executeOperation.signal,
      compileServerLogLevel,

      projectDirectoryUrl,
      jsenvDirectoryRelativeUrl,
      jsenvDirectoryClean,
      outDirectoryName: "out-dev",

      importDefaultExtension,

      compileServerProtocol,
      compileServerPrivateKey,
      compileServerCertificate,
      compileServerIp,
      compileServerPort,
      babelPluginMap,
      customCompilers,
      runtimeSupport: normalizeRuntimeSupport({
        [runtime.name]: runtime.version,
      }),
      compileServerCanReadFromFilesystem,
      compileServerCanWriteOnFilesystem,
    })
    executeOperation.addEndCallback(async () => {
      await stop("execution done")
    })

    const result = await launchAndExecute({
      signal: executeOperation.signal,
      launchAndExecuteLogLevel,

      runtime,
      runtimeParams: {
        projectDirectoryUrl,
        compileServerOrigin,
        outDirectoryRelativeUrl,
        ...runtimeParams,
      },
      executeParams: {
        fileRelativeUrl,
      },

      allocatedMs,
      mirrorConsole,
      captureConsole,
      inheritCoverage,
      collectCoverage,
      measurePerformance,
      collectPerformance,

      stopAfterExecute,
      stopAfterExecuteReason,
      gracefulStopAllocatedMs,

      runtimeConsoleCallback,
      runtimeStartedCallback,
      runtimeStoppedCallback,
      runtimeErrorAfterExecutionCallback,
      runtimeDisconnectCallback,
    })

    if (collectCompileServerInfo) {
      result.outDirectoryRelativeUrl = outDirectoryRelativeUrl
      result.compileServerOrigin = compileServerOrigin
    }

    if (result.status === "errored") {
      if (ignoreError) {
        return result
      }
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
  } finally {
    await executeOperation.end()
  }
}
