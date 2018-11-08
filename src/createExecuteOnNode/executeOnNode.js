import { createExecuteOnNode } from "./createExecuteOnNode.js"
import { open as compileServerOpen } from "../server-compile/index.js"
import { cancellationNone, createCancel } from "../cancel/index.js"

export const executeOnNode = async ({
  cancellation,
  protocol = "http",

  localRoot,
  compileInto,
  compileService,

  watch = false,
  watchPredicate,
  sourceCacheStrategy,
  sourceCacheIgnore,

  file,
  instrument,
  setup,
  teardown,
  verbose,
}) => {
  // if nothing is going to cancel us
  // and we are not watching the file changes
  // we autocancel, close server etc, once the file is executed
  let autoCancel
  if (cancellation === undefined) {
    if (watch) {
      cancellation = cancellationNone
    } else {
      const cancel = createCancel()
      cancellation = cancel.cancellation
      autoCancel = cancel.cancel
    }
  }

  const server = await compileServerOpen({
    cancellation,
    protocol,

    localRoot,
    compileInto,
    compileService,

    watch,
    watchPredicate,
    sourceCacheStrategy,
    sourceCacheIgnore,
  })

  const execute = createExecuteOnNode({
    localRoot,
    remoteRoot: server.origin,
    compileInto,
    hotreload: watch,
    hotreloadSSERoot: server.origin,
  })

  const value = await execute({
    cancellation,
    file,
    instrument,
    setup,
    teardown,
    verbose,
  })

  if (autoCancel) {
    await autoCancel("file executed")
  }

  return value
}
