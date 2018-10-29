import { createNodePlatform } from "../platform/index.js"
import { createCancel } from "../cancel/index.js"
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

const { cancel, cancellation } = createCancel()

listenParent("exit-please", () => {
  // on doit aussi close le eventSource de hotreloading
  // mais je sais pas trop qui a la responsabilite de ca en fait
  // c'est subtil
  cancel().then(() => {
    process.exit(0)
  })
})

listenParent(
  "execute",
  ({
    localRoot,
    remoteRoot,
    compileInto,
    groupMapFile,
    hotreload,
    hotreloadSSERoot,
    file,
    instrument,
    setup,
    teardown,
  }) => {
    // eslint-disable-next-line import/no-dynamic-require
    const groupMap = require(`${localRoot}/${compileInto}/${groupMapFile}`)

    const { executeFile } = createNodePlatform({
      cancellation,
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

    executeFile({ cancellation, file, instrument, setup, teardown }).then(
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
  },
)
