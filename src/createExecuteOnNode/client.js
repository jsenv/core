import { createNodePlatform } from "../platform/index.js"
import { uneval } from "@dmail/uneval"
import { getCompileMapLocalURL } from "../compilePlatformAndSystem.js"
import { createCancel } from "../cancel/index.js"

const { cancellation, cancel } = createCancel()

const sendToParent = (type, data) => {
  // process.send algorithm does not send non enumerable values
  // because it works with JSON.stringify I guess so use uneval
  const source = uneval(data)

  process.send({
    type,
    data: source,
  })
}

const listenParent = (type, callback) => {
  const listener = (event) => {
    if (event.type === type) {
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

// keep checking how https://github.com/dmail/dev-server/commit/a971e5dde3dd275ffa0c5a90220b3d6b514a7461
// impacted hotreload and stufff
// we must move again hotreloading here instead of parent
process.on("SIGINT", () => {
  // cancel will remove listener to process.on('message')
  // which is sufficient to let child process die
  // assuming nothing else keeps it alive
  cancel("process interrupt").then(() => {
    if (process.listeners("SIGINT").length === 1) {
      // ensure child exits in case some code forgot
      // to register 'SIGINT' and keeps process alive
      process.exit(0)
    }
  })
})

cancellation.register(
  listenParent("exit-please", () => {
    process.emit("SIGINT")
  }),
)

cancellation.register(
  listenParent(
    "execute",
    ({ localRoot, remoteRoot, compileInto, file, instrument, setup, teardown }) => {
      const compileMapLocalURL = getCompileMapLocalURL({ localRoot, compileInto })
      // eslint-disable-next-line import/no-dynamic-require
      const compileMap = require(compileMapLocalURL)

      const { executeFile } = createNodePlatform({
        cancellation,
        localRoot,
        remoteRoot,
        compileInto,
        compileMap,
      })

      executeFile({ file, instrument, setup, teardown }).then((value) => {
        sendToParent("execute", value)
      })
    },
  ),
)
