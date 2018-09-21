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
import { createSignal } from "@dmail/signal"

export const openNodeClient = ({ compileURL, remoteRoot, localRoot, detached = false }) => {
  if (detached === false) {
    const execute = ({ file, collectCoverage = false, executeTest = false }) => {
      const close = () => {}

      const promise = Promise.resolve().then(() => {
        const remoteFile = getRemoteLocation({
          compileURL,
          file,
        })

        const { setup, teardown } = getNodeSetupAndTeardowm({ collectCoverage, executeTest })

        Promise.resolve(remoteFile)
          .then(setup)
          .then(() => {
            return ensureSystem({ remoteRoot, localRoot })
              .import(remoteFile)
              .then(teardown)
          })
      })

      return Promise.resolve({ promise, close })
    }

    return Promise.resolve({ execute })
  }

  const clientFile = path.resolve(__dirname, "./client.js")
  let previousID = 0

  const execute = ({
    file,
    autoClose = false,
    autoCloseOnError = false,
    executeTest = false,
    collectCoverage = false,
  }) => {
    const closed = createSignal()

    const close = () => {
      closed.emit()
    }

    const promise = new Promise((resolve, reject) => {
      const id = previousID + 1
      previousID = id

      const child = fork(clientFile, {
        execArgv: [
          // allow vscode to debug else you got port already used
          `--inspect-brk`,
        ],
      })

      const kill = closed.listen(() => {
        child.kill()
      })

      child.on("close", (code) => {
        kill.remove()

        if (code === 12) {
          throw new Error(
            `child exited with 12: forked child wanted to use a non available port for debug`,
          )
        }
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
        compileURL,
        file,
      })
      const { setup, teardown } = getNodeSetupAndTeardowm({ collectCoverage, executeTest })

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
    }).then(
      (value) => {
        if (autoClose) {
          close()
        }
        return value
      },
      (reason) => {
        if (autoCloseOnError) {
          close()
        }
        return Promise.reject(reason)
      },
    )

    return Promise.resolve({ promise, close })
  }

  return Promise.resolve({ execute })
}
