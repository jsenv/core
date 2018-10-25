import { createExecuteOnNode } from "./createExecuteOnNode.js"
import { open as compileServerOpen } from "../server-compile/index.js"
import { createCancellable } from "../cancellable/index.js"

export const executeOnNode = ({
  protocol = "http",

  localRoot,
  compileInto,
  compileService,
  groupMapFile,

  watch = false,
  watchPredicate,
  sourceCacheStrategy,
  sourceCacheIgnore,

  file,
  instrument = false,
  setup,
  teardown,
  verbose,
}) => {
  const cancellable = createCancellable()

  const execution = cancellable.map(
    compileServerOpen({
      protocol,

      localRoot,
      compileInto,
      compileService,

      watch,
      watchPredicate,
      sourceCacheStrategy,
      sourceCacheIgnore,
    }).then((server) => {
      const { execute } = createExecuteOnNode({
        localRoot,
        remoteRoot: server.origin,
        compileInto,
        groupMapFile,
        hotreload: watch,
        hotreloadSSERoot: server.origin,
      })

      return cancellable.map(
        execute({
          file,
          instrument,
          setup,
          teardown,
          verbose,
        }),
      )
    }),
  )

  // this final promise is not mapped by the cancellable
  // because we don't want it to be cancellable
  // this is just that we want to cancel anything that is still runng because watch is false
  const promise = execution.then((value) => {
    if (watch === false) {
      cancellable.cancel()
    }
    return value
  })
  promise.cancel = cancellable.cancel

  return promise
}
