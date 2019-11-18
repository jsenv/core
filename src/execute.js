import {
  createCancellationTokenForProcessSIGINT,
  catchAsyncFunctionCancellation,
} from "@jsenv/cancellation"
import { createLogger } from "@jsenv/logger"
import {
  resolveProjectDirectoryUrl,
  resolveCompileDirectorUrl,
  resolveImportMapFileUrl,
} from "internal/argUtils.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { launchAndExecute } from "internal/executing/launchAndExecute.js"

export const execute = async ({
  cancellationToken = createCancellationTokenForProcessSIGINT(),
  logLevel = "off",
  compileServerLogLevel = logLevel,
  launchLogLevel = logLevel,
  executeLogLevel = logLevel,

  projectDirectoryPath,
  compileDirectoryRelativePath = "./.dist",
  compileDirectoryClean,
  importMapFileRelativePath = "./importMap.json",
  importDefaultExtension,
  fileRelativePath,
  launch,
  babelPluginMap,
  convertMap,

  compileGroupCount = 2,

  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  mirrorConsole = true,
  stopPlatformAfterExecute = false,
  collectNamespace = false,
  collectCoverage = false,
  inheritCoverage = false,
}) => {
  const launchLogger = createLogger({ logLevel: launchLogLevel })
  const executeLogger = createLogger({ logLevel: executeLogLevel })

  const projectDirectoryUrl = resolveProjectDirectoryUrl({ projectDirectoryPath })
  const compileDirectoryUrl = resolveCompileDirectorUrl({
    compileDirectoryRelativePath,
    projectDirectoryUrl,
  })
  const importMapFileUrl = resolveImportMapFileUrl({
    projectDirectoryUrl,
    importMapFileRelativePath,
  })
  if (typeof fileRelativePath !== "string") {
    throw new TypeError(`fileRelativePath must be a string, got ${fileRelativePath}`)
  }
  fileRelativePath = fileRelativePath.replace(/\\/g, "/")
  if (typeof launch !== "function") {
    throw new TypeError(`launch must be a function, got ${launch}`)
  }

  return catchAsyncFunctionCancellation(async () => {
    const { origin: compileServerOrigin } = await startCompileServer({
      cancellationToken,
      logLevel: compileServerLogLevel,

      projectDirectoryUrl,
      compileDirectoryUrl,
      compileDirectoryClean,
      importMapFileUrl,
      importDefaultExtension,
      babelPluginMap,
      convertMap,
      compileGroupCount,

      protocol,
      ip,
      port,
    })

    const result = await launchAndExecute({
      cancellationToken,
      launchLogger,
      executeLogger,
      launch: (params) =>
        launch({
          ...params,
          compileServerOrigin,
          projectDirectoryUrl,
          compileDirectoryUrl,
          importMapFileRelativePath,
          importDefaultExtension,
        }),
      mirrorConsole,
      stopPlatformAfterExecute,
      fileRelativePath,
      collectNamespace,
      collectCoverage,
      inheritCoverage,
    })

    if (result.status === "errored") {
      throw result.error
    }

    return result
  })
}
