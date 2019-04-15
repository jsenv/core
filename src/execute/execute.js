import { normalizePathname } from "/node_modules/@jsenv/module-resolution/index.js"
import { startCompileServer } from "../server-compile/index.js"
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
  babelConfigMap = EXECUTE_DEFAULT_BABEL_CONFIG_MAP,
  importMapFilenameRelative = EXECUTE_DEFAULT_IMPORT_MAP_FILENAME_RELATIVE,
  compileInto = EXECUTE_DEFAULT_COMPILE_INTO,
  compileGroupCount = 2,
  protocol,
  ip,
  port,
  verbose = false,
  launch,
  mirrorConsole = true,
  stopOnceExecuted,
  filenameRelative,
}) =>
  catchAsyncFunctionCancellation(async () => {
    projectFolder = normalizePathname(projectFolder)
    const cancellationToken = createProcessInterruptionCancellationToken()

    const sourceOrigin = `file://${projectFolder}`

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
      verbose,
    })

    return launchAndExecute({
      launch: (options) => launch({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
      cancellationToken,
      mirrorConsole,
      stopOnceExecuted,
      filenameRelative,
      verbose,
    })
  })
