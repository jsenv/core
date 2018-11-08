import { createNodePlatform } from "../platform/index.js"
import { uneval } from "@dmail/uneval"
import { getCompileMapLocalURL } from "../compilePlatformAndSystem.js"

const sendToParent = (type, data) => {
  // process.send algorithm does not send non enumerable values
  // because it works with JSON.stringify I guess so use uneval
  const source = uneval(data)

  process.send({
    type,
    data: source,
  })
}

const listenParentOnce = (type, callback) => {
  const listener = (event) => {
    if (event.type === type) {
      // why do we want to let child process die ?
      // process.removeListener("message", listener)
      callback(eval(`(${event.data})`))
    }
  }

  process.on("message", listener)

  return () => {
    process.removeListener("message", listener)
  }
}

process.on("unhandledRejection", (error) => {
  throw error
})

process.on("SIGINT", () => {
  if (process.listeners("SIGINT").length === 1) {
    process.exit(0)
  }
  // otherwise let any custom "SIGINT" listener do exit
})

listenParentOnce("exit-please", () => {
  process.emit("SIGINT")
})

listenParentOnce(
  "execute",
  ({ localRoot, remoteRoot, compileInto, file, instrument, setup, teardown }) => {
    const compileMapLocalURL = getCompileMapLocalURL({ localRoot, compileInto })
    // eslint-disable-next-line import/no-dynamic-require
    const compileMap = require(compileMapLocalURL)

    const { executeFile } = createNodePlatform({
      localRoot,
      remoteRoot,
      compileInto,
      compileMap,
    })

    executeFile({ file, instrument, setup, teardown }).then((value) => {
      sendToParent("execute", value)
    })
  },
)
