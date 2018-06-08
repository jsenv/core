import "./global-fetch.js"
import { fork } from "child_process"
import path from "path"

export const startNodeClient = () => {
  return Promise.resolve().then(() => {
    const indexFile = path.resolve(__dirname, "./index.js")
    const forkDebugPort = 9226

    const child = fork(indexFile, {
      execArgv: [
        // allow vscode to debug else you got port already used
        `--inspect-brk=${forkDebugPort}`,
      ],
      silent: true,
    })

    child.on("close", (code) => {
      if (code === 12) {
        throw new Error(
          `child exited with 12: forked child wanted to use port ${forkDebugPort} for debug`,
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

        child.once("message", (message) => {
          const { type, data } = message
          if (type === "execute-result" && data.id === id) {
            if (data.result.code === 0) {
              resolve(data.result.value)
            } else {
              reject(data.result.value)
            }
          }
        })

        child.send({
          type: "execute",
          data: {
            id,
            file,
          },
        })
      })
    }

    return { execute, close }
  })
}
