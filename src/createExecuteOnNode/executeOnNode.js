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
  return compileServerOpen({
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

    const execution = execute({
      file,
      instrument,
      setup,
      teardown,
      verbose,
    })

    return execution.then((value) => {
      if (watch === false) {
        execution.cancel()
        server.close()
      }
      return value
    })
  })
}
