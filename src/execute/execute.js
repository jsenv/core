import { startCompileServer } from "../server-compile/index.js"
import { launchAndExecute } from "../launchAndExecute/index.js"
import {
  createProcessInterruptionCancellationToken,
  catchAsyncFunctionCancellation,
} from "../cancellationHelper.js"

export const execute = async ({
  root,
  compileInto,
  pluginMap,
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

    const { origin: remoteRoot } = await startCompileServer({
      cancellationToken,
      root,
      compileInto,
      pluginMap,
      protocol,
      ip,
      port,
      verbose,
    })

    return launchAndExecute({
      launch: (options) => launch({ ...options, localRoot: root, compileInto, remoteRoot }),
      cancellationToken,
      mirrorConsole,
      stopOnceExecuted,
      file,
    })
  })
