import { createNodePlatform } from "../platform/index.js"
import { uneval } from "@dmail/uneval"

const sendToParent = (type, data) => {
  // process.send algorithm does not send non enumerable values
  // because it works with JSON.stringify I guess so use uneval
  const source = uneval(data)

  process.send({
    type,
    data: source,
  })
}

process.on("message", ({ type, data }) => {
  if (type === "exit-please") {
    process.emit("SIGINT")
  }

  if (type === "execute") {
    const {
      localRoot,
      remoteRoot,
      compileInto,
      groupMapFile,
      hotreload,
      hotreloadSSERoot,
      file,
      setup,
      teardown,
    } = eval(`(${data})`)

    // eslint-disable-next-line import/no-dynamic-require
    const groupMap = require(`${localRoot}/${compileInto}/${groupMapFile}`)

    const { executeFile } = createNodePlatform({
      localRoot,
      remoteRoot,
      compileInto,
      groupMap,
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
      (error) => {
        const errorToObject = (error) => {
          if (error && error.status === 500 && error.reason === "parse error") {
            return JSON.parse(error.body)
          }
          if (error && error.code === "MODULE_INSTANTIATE_ERROR") {
            return errorToObject(error.error)
          }
          if (error && error instanceof Error) {
            const object = {}
            Object.getOwnPropertyNames(error).forEach((name) => {
              object[name] = error[name]
            })
            return object
          }

          return {
            message: `rejected with ${JSON.stringify(error, null, "  ")}`,
          }
        }

        sendToParent("execute-result", {
          code: 1,
          value: errorToObject(error),
        })
      },
    )
  }
})
