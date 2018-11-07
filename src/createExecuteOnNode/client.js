import { createNodePlatform } from "../platform/index.js"
import { createCancel } from "../cancel/index.js"
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

const { cancel, cancellation } = createCancel()

// vscode is sending sigint to the child when you ask for it
// from the parent process
// it makes me wonder if the child process should not just be responsible to execuet the file
// but the parent would connect for hotreloading
// well nevermind let's keep going
process.on("SIGINT", () => {
  cancel("child process interrupt").then(() => {
    process.exit(0)
  })
})

listenParent("exit-please", (reason) => {
  cancel(reason).then(() => {
    process.exit(0)
  })
})

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
        sendToParent("restart", `file changed: ${file}`)
      },
    })

    executeFile({ cancellation, file, instrument, setup, teardown }).then(
      (value) => {
        sendToParent("execute", value)
      },
      (error) => {
        sendToParent("error", errorToObject(error))
      },
    )
  },
)
