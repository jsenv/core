import { createCancellationSource } from "@dmail/cancellation"
import { uneval } from "@dmail/uneval"
import { loadNodePlatform } from "../platform/node/loadNodePlatform.js"

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
  // once errored, the child must die
  process.exit(1)
})

process.on("unhandledRejection", (valueRejected) => {
  sendToParent("error", exceptionToObject(valueRejected))
  // once errored, the child must die
  process.exit(1)
})

const listenParentOnce = (type, callback) => {
  const listener = (event) => {
    if (event.type === type) {
      // commenting line below keep this process alive
      process.removeListener("message", listener)
      callback(eval(`(${event.data})`))
    }
  }

  process.on("message", listener)

  return () => {
    process.removeListener("message", listener)
  }
}

const { token, cancel } = createCancellationSource()

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

token.register(
  listenParentOnce(
    "execute",
    ({ compileMap, localRoot, remoteRoot, compileInto, file, instrument, setup, teardown }) => {
      loadNodePlatform({
        compileMap,
        localRoot,
        remoteRoot,
        compileInto,
      })
        .then((platform) => {
          return platform.executeFile({
            file,
            instrument,
            setup,
            teardown,
          })
        })
        .then((value) => {
          sendToParent("done", value)
        })
    },
  ),
)
