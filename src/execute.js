import {
  createCancellationTokenForProcessSIGINT,
  catchAsyncFunctionCancellation,
} from "@jsenv/cancellation"
import { createLogger } from "@jsenv/logger"
import { pathToDirectoryUrl, resolveDirectoryUrl, resolveFileUrl } from "internal/urlUtils.js"
import {
  assertProjectDirectoryPath,
  assertProjectDirectoryExists,
  assertImportMapFileRelativePath,
  assertImportMapFileInsideProject,
  assertCompileDirectoryRelativePath,
  assertCompileDirectoryInsideProject,
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
  compileDirectoryRelativeUrl = "./.dist",
  compileDirectoryClean,
  importMapFileRelativeUrl = "./importMap.json",
  importDefaultExtension,
  fileRelativeUrl,
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

  assertProjectDirectoryPath({ projectDirectoryPath })
  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
  await assertProjectDirectoryExists({ projectDirectoryUrl })

  assertImportMapFileRelativePath({ importMapFileRelativeUrl })
  const importMapFileUrl = resolveFileUrl(importMapFileRelativeUrl, projectDirectoryUrl)
  assertImportMapFileInsideProject({ importMapFileUrl, projectDirectoryUrl })

  assertCompileDirectoryRelativePath({ compileDirectoryRelativeUrl })
  const compileDirectoryUrl = resolveDirectoryUrl(compileDirectoryRelativeUrl, projectDirectoryUrl)
  assertCompileDirectoryInsideProject({ compileDirectoryUrl, projectDirectoryUrl })

  if (typeof fileRelativeUrl !== "string") {
    throw new TypeError(`fileRelativeUrl must be a string, got ${fileRelativeUrl}`)
  }
  fileRelativeUrl = fileRelativeUrl.replace(/\\/g, "/")
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
          importMapFileRelativeUrl,
          importDefaultExtension,
        }),
      mirrorConsole,
      stopPlatformAfterExecute,
      fileRelativeUrl,
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
