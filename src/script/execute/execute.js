import { startCompileServer } from "../../server-compile/index.js"
import { launchAndExecute } from "../../launchAndExecute/index.js"
import {
  createProcessInterruptionCancellationToken,
  catchAsyncFunctionCancellation,
} from "../cancellationHelper.js"

export const execute = catchAsyncFunctionCancellation(
  async ({
    file,
    launch,
    localRoot,
    compileInto,
    pluginMap,
    protocol,
    ip,
    port,
    verbose,
    stopOnceExecuted,
  }) => {
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

    return launchAndExecute(
      (options) => launch({ ...options, localRoot, remoteRoot, compileInto }),
      file,
      {
        cancellationToken,
        stopOnceExecuted,
      },
    )
  },
)
