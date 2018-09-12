// faut vraiment que je teste ça avec https://github.com/GoogleChromeLabs/ndb
// en gros voir si ndb va fonctionner
// pour debug l'éxécution de nodejs avec chrome devtools
// en utilisant system.import

import { fork } from "child_process"
import path from "path"
import { ensureSystem } from "./ensureSystem.js"
import "./global-fetch.js"
import { getRemoteLocation } from "../getRemoteLocation.js"
import { getNodeSetupAndTeardowm } from "../getClientSetupAndTeardown.js"

export const openNodeClient = ({ server, detached = true }) => {
  const remoteRoot = server.url.toString().slice(0, -1)
  const localRoot = server.rootLocation

  if (detached === false) {
    return Promise.resolve().then(() => {
      const close = () => {}

      const execute = ({ file, collectCoverage = false }) => {
        const { setup, teardown } = getNodeSetupAndTeardowm({ collectCoverage })

        setup(file)
        return ensureSystem({ remoteRoot, localRoot })
          .import(file)
          .then(teardown)
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

    const execute = ({ file, collectCoverage = false }) => {
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

        const remoteFile = getRemoteLocation({
          server,
          file,
        })
        const { setup, teardown } = getNodeSetupAndTeardowm({ collectCoverage })

        child.send({
          type: "execute",
          id,
          data: {
            remoteRoot,
            localRoot,
            file: remoteFile,
            setupSource: `(${setup.toString()})`,
            teardownSource: `(${teardown.toString()})`,
          },
        })
      })
    }

    return { execute, close }
  })
}
