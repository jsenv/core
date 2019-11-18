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

  assertProjectDirectoryPath({ projectDirectoryPath })
  const projectDirectoryUrl = pathToDirectoryUrl(projectDirectoryPath)
  await assertProjectDirectoryExists({ projectDirectoryUrl })

  assertImportMapFileRelativePath({ importMapFileRelativePath })
  const importMapFileUrl = resolveFileUrl(importMapFileRelativePath, projectDirectoryUrl)
  assertImportMapFileInsideProject({ importMapFileUrl, projectDirectoryUrl })

  assertCompileDirectoryRelativePath({ compileDirectoryRelativePath })
  const compileDirectoryUrl = resolveDirectoryUrl(compileDirectoryRelativePath, projectDirectoryUrl)
  assertCompileDirectoryInsideProject({ compileDirectoryUrl, projectDirectoryUrl })

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
