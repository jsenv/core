import { startCompileServer } from "../server-compile/index.js"
import { launchAndExecute } from "../launchAndExecute/index.js"
import {
  createProcessInterruptionCancellationToken,
  catchAsyncFunctionCancellation,
} from "../cancellationHelper.js"

export const execute = async ({
  file,
  localRoot,
  compileInto,
  pluginMap,
  protocol,
  ip,
  port,
  verbose = false,
  launch,
  mirrorConsole = true,
  stopOnceExecuted,
}) =>
  catchAsyncFunctionCancellation(async () => {
    const cancellationToken = createProcessInterruptionCancellationToken()

    const { origin: remoteRoot } = await startCompileServer({
      cancellationToken,
      localRoot,
      compileInto,
      pluginMap,
      protocol,
      ip,
      port,
      verbose,
    })

    return launchAndExecute({
      launch: (options) => launch({ ...options, localRoot, compileInto, remoteRoot }),
      cancellationToken,
      mirrorConsole,
      stopOnceExecuted,
      file,
    })
  })
