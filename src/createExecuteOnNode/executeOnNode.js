import { createExecuteOnNode } from "./createExecuteOnNode.js"

export const executeOnNode = ({
  openCompileServer,
  protocol = "http",

  root,
  into,

  file,
  watch = false,
  verbose,

  ...rest
}) => {
  const cacheFolder = into
  const compileFolder = `${into}__dynamic__`

  return openCompileServer({
    root,
    cacheFolder,
    compileFolder,
    protocol,
    watch,
    ...rest,
  }).then((server) => {
    const { execute } = createExecuteOnNode({
      localRoot: root,
      remoteRoot: server.origin,
      remoteCompileDestination: compileFolder,
    })

    return execute({
      file,
      hotreload: watch,
      verbose,
    }).then((value) => {
      if (watch === false) {
        server.close()
      }
      return value
    })
  })
}
