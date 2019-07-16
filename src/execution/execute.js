import { startCompileServer } from "../compile-server/index.js"
import { launchAndExecute } from "../launchAndExecute/index.js"
import {
  createProcessInterruptionCancellationToken,
  catchAsyncFunctionCancellation,
} from "../cancellationHelper.js"
import { LOG_LEVEL_OFF } from "../logger.js"

export const execute = async ({
  fileRelativePath,
  launch,
  projectPath,
  compileIntoRelativePath,
  importMapRelativePath,
  importDefaultExtension,
  browserPlatformRelativePath,
  nodePlatformRelativePath,
  browserGroupResolverRelativePath,
  nodeGroupResolverRelativePath,
  babelPluginMap,
  compileGroupCount = 2,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  cleanCompileInto,
  compileServerLogLevel = LOG_LEVEL_OFF,
  executionLogLevel = LOG_LEVEL_OFF,
  mirrorConsole = true,
  stopOnceExecuted = false,
  collectNamespace = false,
  collectCoverage = false,
  inheritCoverage = false,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    fileRelativePath = fileRelativePath.replace(/\\/g, "/")

    const { origin: compileServerOrigin } = await startCompileServer({
      cancellationToken,
      projectPath,
      compileIntoRelativePath,
      importMapRelativePath,
      importDefaultExtension,
      browserPlatformRelativePath,
      nodePlatformRelativePath,
      browserGroupResolverRelativePath,
      nodeGroupResolverRelativePath,
      babelPluginMap,
      compileGroupCount,
      protocol,
      ip,
      port,
      logLevel: compileServerLogLevel,
      cleanCompileInto,
    })

    const result = await launchAndExecute({
      cancellationToken,
      launch: (options) =>
        launch({ ...options, compileServerOrigin, projectPath, compileIntoRelativePath }),
      logLevel: executionLogLevel,
      mirrorConsole,
      stopOnceExecuted,
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
