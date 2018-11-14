import { createExecuteOnNode } from "./createExecuteOnNode.js"
import { open as compileServerOpen } from "../server-compile/index.js"
import { cancellationNone, createCancel } from "../cancel/index.js"

export const executeOnNode = async ({
  cancellation,
  protocol = "http",

  localRoot,
  compileInto,
  compileService,

  hotreload = false,
  restartStart,
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
    if (hotreload) {
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

    sourceCacheStrategy,
    sourceCacheIgnore,
  })

  const execute = createExecuteOnNode({
    localRoot,
    remoteRoot: server.origin,
    compileInto,
    hotreload,
    hotreloadSSERoot: server.origin,
    verbose,
    restartStart,
  })

  let promise = execute({
    cancellation,
    file,
    instrument,
    setup,
    teardown,
  })
  if (autoCancel) {
    promise.then(() => {
      autoCancel("file executed")
    })
  }
  if (hotreload) {
    // script error occuring during hotreloading are non fatal
    promise = promise.catch((error) => {
      console.warn(error)
      return null
    })
  }

  return promise
}
