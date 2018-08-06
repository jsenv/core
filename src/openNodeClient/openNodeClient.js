import { fork } from "child_process"
import path from "path"
import { ensureSystem } from "./ensureSystem.js"
import "./global-fetch.js"

export const openNodeClient = ({ server, detached = true }) => {
  const remoteRoot = server.url.toString().slice(0, -1)
  const localRoot = server.rootLocation

  if (detached === false) {
    return Promise.resolve().then(() => {
      const close = () => {}

      const execute = ({ file }) => {
        console.log("importing", file)
        return ensureSystem({ remoteRoot, localRoot }).import(file)
      }

      return { close, execute }
    })
  }

  return Promise.resolve().then(() => {
    const clientFile = path.resolve(__dirname, "./client.js")

    const child = fork(clientFile, {
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
            remoteRoot,
            localRoot,
          },
        })
      })
    }

    return { execute, close }
  })
}
