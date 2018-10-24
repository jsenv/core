import { createExecuteOnNode } from "./createExecuteOnNode.js"
import { open as compileServerOpen } from "../server-compile/index.js"

export const executeOnNode = ({
  protocol = "http",

  localRoot,
  compileInto,
  compileService,
  groupMap,
  groupMapDefaultId,

  watch = false,
  watchPredicate,
  sourceCacheStrategy,
  sourceCacheIgnore,

  file,
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
      groupMap,
      groupMapDefaultId,
      hotreload: watch,
      hotreloadSSERoot: server.origin,
    })

    return execute({
      file,
      verbose,
    }).then((value) => {
      if (watch === false) {
        server.close()
      }
      return value
    })
  })
}
