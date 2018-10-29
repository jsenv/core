import { fork } from "child_process"
import path from "path"
import { uneval } from "@dmail/uneval"
import { cancellationNone } from "../cancel/index.js"
import { reduceToFirstOrPending, mapPending } from "../promiseHelper.js"

const root = path.resolve(__dirname, "../../../")
const nodeClientFile = `${root}/dist/src/createExecuteOnNode/client.js`

export const createExecuteOnNode = ({
  localRoot,
  remoteRoot,
  compileInto,
  groupMapFile,
  hotreload = false,
  hotreloadSSERoot,
}) => {
  const execute = ({
    cancellation = cancellationNone,
    file,
    instrument = false,
    setup = () => {},
    teardown = () => {},
    verbose = false,
  }) => {
    const log = (...args) => {
      if (verbose) {
        console.log(...args)
      }
    }

    const forkChild = () => {
      return cancellation.wrap((register) => {
        return new Promise((resolve, reject) => {
          const child = fork(nodeClientFile, {
            execArgv: [
              // allow vscode to debug else you got port already used
              `--inspect-brk`,
            ],
          })
          log(`fork ${nodeClientFile} to execute ${file}`)
          child.on("message", (message) => {
            log(`receive message from child ${message.data}`)
          })

          const sendToChild = (type, data) => {
            const source = uneval(data, { showFunctionBody: true })
            log(`send to child ${type}: ${source}`)
            child.send({
              type,
              data: source,
            })
          }

          const closed = new Promise((resolve) => {
            child.once("close", (code) => {
              log(`child closed with code ${code}`)
              resolve(code)
            })
          })

          const childExit = () => {
            // if closed hapened, no need to close
            return mapPending(closed, () => {
              // we have to do this instead of child.kill('SIGINT') because
              // on windows, it would kill the child immediatly
              sendToChild("exit-please")
              return closed
            })
          }

          const cancelled = new Promise((resolve) => {
            // kill the child when cancel called
            register(() => {
              resolve()
              log(`cancel called, ask politely to the child to exit`)
              return childExit()
            })
          })

          const executed = new Promise((resolve) => {
            child.on("message", (message) => {
              const source = message.data
              if (message.type === "execute-result") {
                resolve(eval(`(${source})`))
              }
            })
          })

          const restartAsked = new Promise((resolve) => {
            child.on("message", (message) => {
              if (message.type === "restart") {
                resolve(eval(`(${message.data})`))
              }
            })
          })

          // throw or reject when child is closed except if child ask to restart before
          // (because in that case it will be handled by restart)
          reduceToFirstOrPending([closed, restartAsked]).then((code) => {
            if (code === 12) {
              throw new Error(
                `child exited with 12: forked child wanted to use a non available port for debug`,
              )
            }
            if (code !== 0) {
              reject(`exited with code ${code}`)
            }
          })

          // resolve or reject when child has sent execution result, except if child ask to restart before
          reduceToFirstOrPending([executed, restartAsked]).then(({ code, value }) => {
            if (code === 0) {
              resolve(value)
            } else {
              reject(value)
            }
          })

          restartAsked.then(() => {
            log(`restart first step: ask politely to the child to exit`)
            // fork a new child when child is closed except if cancel was called

            reduceToFirstOrPending([childExit(), cancelled]).then((code) => {
              log(`restart last step: child closed with ${code}`)
              if (code === 0 || code === null) {
                forkChild()
              } else {
                throw new Error(`child exited with ${code} after asking to restart`)
              }
            })
            log(`restart second step: wait for child to close`)
          })

          sendToChild("execute", {
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
          })
        }).catch((error) => {
          const localError = new Error(error.message)
          Object.assign(localError, error)
          console.error(localError)

          return Promise.reject(localError)
        })
      })
    }

    return forkChild()
  }

  return execute
}
