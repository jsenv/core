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
  updateProcessExitCode = true,
  ...rest
}) => {
  return catchCancellation(async () => {
    projectDirectoryUrl = assertProjectDirectoryUrl({ projectDirectoryUrl })
    await assertProjectDirectoryExists({ projectDirectoryUrl })

    if (typeof fileRelativeUrl !== "string") {
      throw new TypeError(`fileRelativeUrl must be a string, got ${fileRelativeUrl}`)
    }
    fileRelativeUrl = fileRelativeUrl.replace(/\\/g, "/")
    if (typeof launch !== "function") {
      throw new TypeError(`launch must be a function, got ${launch}`)
    }

    const { outDirectoryRelativeUrl, origin: compileServerOrigin } = await startCompileServer({
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
    })

    return launchAndExecute({
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
  }).then(
    (result) => {
      if (result.status === "errored") {
        // unexpected execution error
        // -> update process.exitCode by default
        // (we can disable this for testing)
        if (updateProcessExitCode) {
          process.exitCode = 1
        }
        throw result.error
      }
      return result
    },
    (e) => {
      // unexpected internal error
      // -> always updates process.exitCode
      process.exitCode = 1
      throw e
    },
  )
}
