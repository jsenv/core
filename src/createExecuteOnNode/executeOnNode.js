import { createExecuteOnNode } from "./createExecuteOnNode.js"
import { open as compileServerOpen } from "../server-compile/index.js"

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
  const execution = compileServerOpen({
    protocol,

    localRoot,
    compileInto,
    compileService,

    watch,
    watchPredicate,
    sourceCacheStrategy,
    sourceCacheIgnore,
  })
    .then((server) => {
      const execute = createExecuteOnNode({
        localRoot,
        remoteRoot: server.origin,
        compileInto,
        groupMapFile,
        hotreload: watch,
        hotreloadSSERoot: server.origin,
      })

      return execute({
        file,
        instrument,
        setup,
        teardown,
        verbose,
      })
    })
    .then((value) => {
      if (watch === false) {
        execution.cancel()
      }
      return value
    })

  return execution
}
