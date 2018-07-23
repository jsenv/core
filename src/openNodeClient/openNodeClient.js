import { fork } from "child_process"
import path from "path"
import "./global-fetch.js"

export const openNodeClient = () => {
  return Promise.resolve().then(() => {
    const indexFile = path.resolve(__dirname, "./index.js")

    const child = fork(indexFile, {
      execArgv: [
        // allow vscode to debug else you got port already used
        `--inspect-brk`,
      ],
    })

    child.on("close", (code) => {
      if (code === 12) {
        throw new Error(
          `child exited with 12: forked child wanted to use a non available port for debug`,
        )
      }
    })

    const close = () => {
      child.kill()
    }

    let previousID = 0

    const execute = ({ file }) => {
      return new Promise((resolve, reject) => {
        const id = previousID + 1
        previousID = id

        child.once("close", (code) => {
          if (code !== 0) {
            reject(`exited with code ${code}`)
          }
        })

        const onmessage = (message) => {
          if (message.id !== id) {
            return
          }

          const { type, data } = message
          if (type === "execute-result") {
            child.removeListener("message", onmessage)
            if (data.code === 0) {
              resolve(data.value)
            } else {
              console.log("rejecting")
              reject(data.value)
            }
          }
        }

        child.on("message", onmessage)

        child.send({
          type: "execute",
          id,
          data: {
            file,
          },
        })
      })
    }

    return { execute, close }
  })
}
