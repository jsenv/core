import { createNodeLoader } from "@dmail/module-loader/src/node/index.js"

const System = createNodeLoader()

global.System = System

process.on("message", ({ type, data }) => {
  if (type === "execute") {
    const { id, file } = data
    System.import(file).then(
      (value) => {
        process.send({
          type: "execute-result",
          data: {
            id,
            result: {
              code: 0,
              value,
            },
          },
        })
      },
      (reason) => {
        process.send({
          type: "execute-result",
          data: {
            id,
            result: {
              code: 1,
              value: reason,
            },
          },
        })
      },
    )
  }
})
