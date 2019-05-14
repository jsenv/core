import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { startCompileServer } from "../compile-server/index.js"
import { launchAndExecute } from "../launchAndExecute/index.js"
import {
  createProcessInterruptionCancellationToken,
  catchAsyncFunctionCancellation,
} from "../cancellationHelper.js"
import {
  EXECUTE_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  EXECUTE_DEFAULT_COMPILE_INTO,
  EXECUTE_DEFAULT_BABEL_CONFIG_MAP,
} from "./execute-constant.js"

export const execute = async ({
  projectFolder,
  filenameRelative,
  launch,
  importMapFilenameRelative = EXECUTE_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  compileInto = EXECUTE_DEFAULT_COMPILE_INTO,
  babelConfigMap = EXECUTE_DEFAULT_BABEL_CONFIG_MAP,
  compileGroupCount = 2,
  protocol = "http",
  ip = "127.0.0.1",
  port = 0,
  compileServerLogLevel = "off",
  executionLogLevel = "off",
  mirrorConsole = true,
  stopOnceExecuted = false,
}) =>
  catchAsyncFunctionCancellation(async () => {
    projectFolder = normalizePathname(projectFolder)
    const cancellationToken = createProcessInterruptionCancellationToken()

    const { origin: compileServerOrigin } = await startCompileServer({
      cancellationToken,
      importMapFilenameRelative,
      projectFolder,
      compileInto,
      babelConfigMap,
      compileGroupCount,
      protocol,
      ip,
      port,
      logLevel: compileServerLogLevel,
    })

    return launchAndExecute({
      cancellationToken,
      launch: (options) => launch({ ...options, projectFolder, compileServerOrigin, compileInto }),
      logLevel: executionLogLevel,
      mirrorConsole,
      stopOnceExecuted,
      filenameRelative,
    })
  })
