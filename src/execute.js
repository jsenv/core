import {
  createProcessInterruptionCancellationToken,
  catchAsyncFunctionCancellation,
} from "@dmail/cancellation"
import { pathToDirectoryUrl, resolveDirectoryUrl } from "./private/urlUtils.js"
import { launchAndExecute } from "./launchAndExecute.js"
import { startCompileServer } from "./startCompileServer.js"

export const execute = async ({
  logLevel = "off",
  compileServerLogLevel = logLevel,
  launchLogLevel = logLevel,
  executeLogLevel = logLevel,

  fileRelativePath,
  launch,
  projectDirectoryPath,
  compileDirectoryRelativePath = "./.dist",
  compileDirectoryClean,
  importMapFileRelativePath = "./importMap.json",
  importDefaultExtension,
  browserPlatformFileUrl,
  nodePlatformFileUrl,
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
  if (typeof projectDirectoryPath !== "string") {
    throw new TypeError(`projectDirectoryPath must be a string, got ${projectDirectoryPath}`)
  }
  if (typeof compileDirectoryRelativePath !== "string") {
    throw new TypeError(
      `compileDirectoryRelativePath must be a string, got ${compileDirectoryRelativePath}`,
    )
  }
  if (typeof fileRelativePath !== "string") {
    throw new TypeError(`fileRelativePath must be a string, got ${fileRelativePath}`)
  }
  if (typeof launch !== "function") {
    throw new TypeError(`launch must be a function, got ${launch}`)
  }

  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
  const compileDirectoryUrl = resolveDirectoryUrl(compileDirectoryRelativePath, projectDirectoryUrl)

  fileRelativePath = fileRelativePath.replace(/\\/g, "/")

  return catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const { origin: compileServerOrigin } = await startCompileServer({
      cancellationToken,
      logLevel: compileServerLogLevel,
      projectDirectoryUrl,
      compileDirectoryUrl,
      compileDirectoryClean,
      importMapFileRelativePath,
      importDefaultExtension,
      babelPluginMap,
      convertMap,
      browserPlatformFileUrl,
      nodePlatformFileUrl,

      compileGroupCount,

      protocol,
      ip,
      port,
    })

    const result = await launchAndExecute({
      cancellationToken,
      launchLogLevel,
      executeLogLevel,
      launch: (options) =>
        launch({
          ...options,
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
