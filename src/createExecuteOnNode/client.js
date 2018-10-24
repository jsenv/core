import { createNodePlatform } from "../platform/index.js"
import { uneval } from "@dmail/uneval"

const sendToParent = (type, data) => {
  process.send({
    type,
    data: uneval(data),
  })
}

process.on("message", ({ type, data }) => {
  if (type === "exit-please") {
    process.emit("SIGINT")
  }

  if (type === "execute") {
    const {
      localRoot,
      compileInto,
      compatMap,
      compatMapDefaultId,
      hotreload,
      hotreloadSSERoot,
      file,
      setup,
      teardown,
    } = eval(data)

    const { executeFile } = createNodePlatform({
      localRoot,
      compileInto,
      compatMap,
      compatMapDefaultId,
      hotreload,
      hotreloadSSERoot,
      hotreloadCallback: (data) => {
        sendToParent("restart", data)
      },
    })

    executeFile(file, setup, teardown).then(
      (value) => {
        sendToParent("execute-result", {
          code: 0,
          value,
        })
      },
      (reason) => {
        // process.send algorithm does not send non enumerable values
        // but for error.message, error.stack we would like to get them
        // se we force all object properties to be enumerable
        // we could use @dmail/uneval here instead, for now let's keep it simple
        sendToParent("execute-result", {
          code: 1,
          value: reason,
        })
      },
    )
  }
})
