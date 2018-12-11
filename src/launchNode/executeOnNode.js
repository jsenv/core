import { createCancellationSource, createCancellationToken } from "@dmail/cancellation"
import { open as compileServerOpen } from "../server-compile/index.js"
import { createExecuteOnNode } from "./createExecuteOnNode.js"

export const executeOnNode = async ({
  cancellationToken,
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
  if (cancellationToken === undefined) {
    if (hotreload) {
      cancellationToken = createCancellationToken()
    } else {
      const autoCancelSource = createCancellationSource()
      cancellationToken = autoCancelSource.token
      autoCancel = autoCancelSource.cancel
    }
  }

  const server = await compileServerOpen({
    cancellationToken,
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
    cancellationToken,
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
