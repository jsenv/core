import { openCompileServer } from "../openCompileServer/index.js"
import { createExecuteOnNode } from "./createExecuteOnNode.js"

export const executeOnNode = ({
  root,
  into,
  file,
  watch = false,
  watchPredicate,
  instrument = false,
  instrumentPredicate,
  verbose,
}) => {
  return openCompileServer({
    root,
    into,
    protocol: "http",
    ip: "127.0.0.1",
    port: 8760,
    instrument,
    instrumentPredicate,
    watch,
    watchPredicate,
  }).then((server) => {
    const { execute } = createExecuteOnNode({
      localRoot: root,
      remoteRoot: server.origin,
      remoteCompileDestination: into,
    })

    return execute({
      file,
      hotreload: watch,
      verbose,
    }).then(({ promise, cancel }) => {
      promise = promise.then((value) => {
        if (watch === false) {
          cancel()
          server.close()
        }
        return value
      })
      return { promise, cancel }
    })
  })
}
