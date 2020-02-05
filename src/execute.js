import {
  catchCancellation,
  // createCancellationTokenForProcess
} from "@jsenv/util"
import { createCancellationTokenForProcessSIGINT } from "@jsenv/cancellation"
import { createLogger } from "@jsenv/logger"
import { assertProjectDirectoryUrl, assertProjectDirectoryExists } from "./internal/argUtils.js"
import { startCompileServer } from "./internal/compiling/startCompileServer.js"
import { launchAndExecute } from "./internal/executing/launchAndExecute.js"

export const execute = async ({
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  logLevel = "warn",
  compileServerLogLevel = logLevel,
  launchLogLevel = logLevel,
  executeLogLevel = logLevel,

  projectDirectoryUrl,
  jsenvDirectoryRelativeUrl,
  jsenvDirectoryClean,
  importMapFileRelativeUrl,
  importDefaultExtension,
  fileRelativeUrl,

  babelPluginMap,
  convertMap,
  compileGroupCount = 2,

  protocol = "http",
  ip = "127.0.0.1",
  port = 0,

  launch,
  mirrorConsole = true,
  stopPlatformAfterExecute = true,
  updateProcessExitCode = true,
  ...rest
}) => {
  return catchCancellation(async () => {
    const launchLogger = createLogger({ logLevel: launchLogLevel })
    const executeLogger = createLogger({ logLevel: executeLogLevel })

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

      babelPluginMap,
      convertMap,
      compileGroupCount,

      protocol,
      ip,
      port,
    })

    return launchAndExecute({
      cancellationToken,
      launchLogger,
      executeLogger,

      fileRelativeUrl,
      launch: (params) =>
        launch({
          projectDirectoryUrl,
          outDirectoryRelativeUrl,
          compileServerOrigin,
          ...params,
        }),
      mirrorConsole,
      stopPlatformAfterExecute,
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
