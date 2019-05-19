import { startCompileServer } from "../compile-server/index.js"
import { launchAndExecute } from "../launchAndExecute/index.js"
import {
  createProcessInterruptionCancellationToken,
  catchAsyncFunctionCancellation,
} from "../cancellationHelper.js"
import {
  DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  DEFAULT_BABEL_CONFIG_MAP,
} from "./execute-constant.js"
import { LOG_LEVEL_OFF } from "../logger.js"

export const execute = async ({
  fileRelativePath,
  launch,
  projectFolder,
  compileIntoRelativePath = DEFAULT_COMPILE_INTO_RELATIVE_PATH,
  importMapRelativePath = DEFAULT_IMPORT_MAP_RELATIVE_PATH,
  babelConfigMap = DEFAULT_BABEL_CONFIG_MAP,
  compileGroupCount = 2,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  compileServerLogLevel = LOG_LEVEL_OFF,
  executionLogLevel = LOG_LEVEL_OFF,
  mirrorConsole = true,
  stopOnceExecuted = false,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const { origin: compileServerOrigin } = await startCompileServer({
      cancellationToken,
      projectFolder,
      compileIntoRelativePath,
      importMapRelativePath,
      babelConfigMap,
      compileGroupCount,
      protocol,
      ip,
      port,
      logLevel: compileServerLogLevel,
    })

    const result = await launchAndExecute({
      cancellationToken,
      launch: (options) =>
        launch({ ...options, compileServerOrigin, projectFolder, compileIntoRelativePath }),
      logLevel: executionLogLevel,
      mirrorConsole,
      stopOnceExecuted,
      fileRelativePath,
    })

    if (result.status === "errored") {
      throw result.error
    }

    return result
  })
