import { fork } from "child_process"
import path from "path"
import { createSignal } from "@dmail/signal"
import { cancellableAction } from "../signalHelper.js"
import { uneval } from "@dmail/uneval"

const root = path.resolve(__dirname, "../../../")
const nodeClientFile = `${root}/src/createExecuteOnNode/client.js`

export const createExecuteOnNode = ({ localRoot, remoteRoot, compileInto, hotreloadSSERoot }) => {
  const execute = ({
    file,
    setup = () => {},
    teardown = () => {},
    hotreload = false,
    autoClose = false,
    autoCloseOnError = false,
    verbose = false,
  }) => {
    const log = (...args) => {
      if (verbose) {
        console.log(...args)
      }
    }

    const forkChild = () => {
      const cancelled = createSignal({ smart: true })
      const cancel = cancelled.emit

      const promise = new Promise((resolve, reject) => {
        const child = fork(nodeClientFile, {
          execArgv: [
            // allow vscode to debug else you got port already used
            `--inspect-brk`,
          ],
        })
        log(`fork a child to execute ${file}`)

        const sendToChild = (type, data) => {
          log(`send to child ${type}: ${JSON.stringify(data, null, "  ")}`)
          child.send({
            type,
            data: uneval(data),
          })
        }

        const closed = createSignal()
        child.once("close", (code) => {
          log(`child closed with code ${code}`)
          closed.emit(code)
        })

        const executed = createSignal()
        const restartAsked = createSignal()
        child.on("message", (message) => {
          log(`receive message from child ${JSON.stringify(message, null, "  ")}`)

          if (message.type === "execute-result") {
            executed.emit(message.data)
          }
          if (message.type === "restart") {
            restartAsked.emit(message.data)
          }
        })

        // kill the child when cancel called except if child has closed before
        cancellableAction(
          () => {
            log(`cancel called, ask politely to the child to exit`)
            sendToChild("exit-please")
          },
          cancelled,
          closed,
        )
        // throw or reject when child is closed except if child ask to restart before
        // (because in that case it will be handled by restart)
        cancellableAction(
          (code) => {
            if (code === 12) {
              throw new Error(
                `child exited with 12: forked child wanted to use a non available port for debug`,
              )
            }
            if (code !== 0) {
              reject(`exited with code ${code}`)
            }
          },
          closed,
          restartAsked,
        )
        // resolve or reject when child has sent execution result, except if child ask to restart before
        cancellableAction(
          ({ code, value }) => {
            if (code === 0) {
              resolve(value)
            } else {
              console.log("rejecting")
              reject(value)
            }
          },
          executed,
          restartAsked,
        )

        restartAsked.listenOnce(() => {
          // fork a new child when child is closed except if cancel was called
          cancellableAction(
            (code) => {
              log(`restart last step: child closed with ${code}`)
              if (code === 0 || code === null) {
                forkChild()
              } else {
                throw new Error(`child exited with ${code} after asking to restart`)
              }
            },
            closed,
            cancelled,
          )

          log(`restart first step: ask politely to the child to exit`)
          // we have to do this instead of child.kill('SIGINT') because, on windows, it would kill the child immediatly
          sendToChild("exit-please")
          log(`restart second step: wait for child to close`)
        })

        sendToChild("execute", {
          localRoot,
          remoteRoot,
          compileInto,
          hotreload,
          hotreloadSSERoot,
          file,
          setup,
          teardown,
        })
      }).then(
        (value) => {
          if (autoClose) {
            cancel()
          }
          return value
        },
        (reason) => {
          if (autoCloseOnError) {
            cancel()
          }
          return Promise.reject(reason)
        },
      )
      promise.cancel = cancel

      return promise
    }

    return forkChild()
  }

  return { execute }
}
