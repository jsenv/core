import { createNodePlatform } from "../platform/index.js"
import { uneval } from "@dmail/uneval"
import { getCompileMapLocalURL } from "../compilePlatformAndSystem.js"
import { createCancel } from "../cancel/index.js"

const sendToParent = (type, data) => {
  // process.send algorithm does not send non enumerable values
  // because it works with JSON.stringify I guess so use uneval
  const source = uneval(data)

  process.send({
    type,
    data: source,
  })
}

const exceptionToObject = (exception) => {
  if (exception && exception instanceof Error) {
    const object = {}
    Object.getOwnPropertyNames(exception).forEach((name) => {
      object[name] = exception[name]
    })
    return object
  }

  return {
    message: exception,
  }
}

process.on("uncaughtException", (valueThrowed) => {
  sendToParent("error", exceptionToObject(valueThrowed))
  process.exit(1)
})

process.on("unhandledRejection", (valueRejected) => {
  sendToParent("error", exceptionToObject(valueRejected))
  process.exit(1)
})

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

const { cancellation, cancel } = createCancel()

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
  listenParent("interrupt", () => {
    process.emit("SIGINT")
  }),
)

cancellation.register(
  listenParent(
    "execute",
    ({
      localRoot,
      remoteRoot,
      compileInto,
      hotreload,
      hotreloadSSERoot,
      file,
      instrument,
      setup,
      teardown,
    }) => {
      const compileMapLocalURL = getCompileMapLocalURL({ localRoot, compileInto })
      // eslint-disable-next-line import/no-dynamic-require
      const compileMap = require(compileMapLocalURL)

      const { executeFile } = createNodePlatform({
        cancellation,
        localRoot,
        remoteRoot,
        compileInto,
        compileMap,
        hotreload,
        hotreloadSSERoot,
        hotreloadCallback: ({ file }) => {
          sendToParent("restart-request", `file changed: ${file}`)
        },
      })

      executeFile({ file, instrument, setup, teardown }).then((value) => {
        sendToParent("done", value)
      })
    },
  ),
)
