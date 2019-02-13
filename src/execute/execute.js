import { pathnameToFileHref } from "@jsenv/module-resolution"
import { startCompileServer } from "../server-compile/index.js"
import { launchAndExecute } from "../launchAndExecute/index.js"
import {
  createProcessInterruptionCancellationToken,
  catchAsyncFunctionCancellation,
} from "../cancellationHelper.js"

export const execute = async ({
  projectFolder,
  compileInto,
  babelPluginDescription,
  protocol,
  ip,
  port,
  verbose = false,
  launch,
  mirrorConsole = true,
  stopOnceExecuted,
  file,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const sourceOrigin = pathnameToFileHref(projectFolder)

    const { origin: compileServerOrigin } = await startCompileServer({
      cancellationToken,
      projectFolder,
      compileInto,
      babelPluginDescription,
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
      file,
    })
  })
