import { fork } from "child_process"
import path from "path"
import { uneval } from "@dmail/uneval"
import { cancellationNone } from "../cancel/index.js"
import { registerEvent, eventRace } from "../eventHelper.js"

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

    const forkChild = async () => {
      await cancellation.toPromise()

      const child = fork(nodeClientFile, {
        execArgv: [
          // allow vscode to debug else you got port already used
          `--inspect-brk`,
        ],
      })
      log(`fork ${nodeClientFile} to execute ${file}`)

      const childMessageRegister = (callback) => registerEvent(child, "message", callback)

      const closeRegister = (callback) => registerEvent(child, "close", callback)

      const registerChildEvent = (name, callback) => {
        return registerEvent(child, "message", ({ type, data }) => {
          if (name === type) {
            callback(eval(`(${data})`))
          }
        })
      }

      const restartRegister = (callback) => registerChildEvent("restart", callback)

      childMessageRegister(({ type, data }) => {
        log(`receive message from child ${type}:${data}`)
      })
      closeRegister((code) => {
        log(`child closed with code ${code}`)
      })

      const sendToChild = (type, data) => {
        const source = uneval(data, { showFunctionBody: true })
        log(`send to child ${type}: ${source}`)
        child.send({
          type,
          data: source,
        })
      }

      const childExit = (reason) => {
        sendToChild("exit-please", reason)
      }

      const close = (reason) => {
        childExit(reason)

        return new Promise((resolve, reject) => {
          closeRegister((code) => {
            if (code === 0 || code === null) {
              resolve()
            } else {
              reject()
            }
          })
        })
      }

      const restart = (reason) => {
        // if we first receive restart we fork a new child
        log(`restart first step: ask politely to the child to exit`)
        childExit(reason)
        log(`restart second step: wait for child to close`)

        return new Promise((resolve, reject) => {
          eventRace({
            cancel: {
              register: cancellation.register,
              callback: (reason) => {
                log(`restart cancelled because ${reason}`)
                // we have nothing to do, the child will close
                // and we won't fork a new one
              },
            },
            close: {
              register: closeRegister,
              callback: (code) => {
                log(`restart last step: child closed with ${code}`)
                if (code === 0 || code === null) {
                  resolve(forkChild())
                } else {
                  reject(new Error(`child exited with ${code} after asking to restart`))
                }
              },
            },
          })
        })
      }

      await new Promise((resolve, reject) => {
        eventRace({
          cancel: {
            register: cancellation.register,
            callback: close,
          },
          close: {
            register: closeRegister,
            callback: (code) => {
              // child is not expected to close, we reject when it happens
              if (code === 12) {
                reject(
                  new Error(
                    `child exited with 12: forked child wanted to use a non available port for debug`,
                  ),
                )
                return
              }
              reject(`unexpected child close with code: ${code}`)
            },
          },
          restart: {
            register: restartRegister,
            callback: (reason) => resolve(restart(reason)),
          },
          execute: {
            register: (callback) => registerChildEvent("execute-result", callback),
            callback: ({ code, value }) => {
              // child is executed as expected
              if (code === 0) {
                resolve(value)
              } else {
                const localError = new Error(value.message)
                Object.assign(localError, value)
                console.error(localError)

                reject(localError)
              }
            },
          },
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
      })

      eventRace({
        cancel: {
          register: cancellation.register,
          callback: close,
        },
        restart: {
          register: restartRegister,
          callback: restart,
        },
      })
    }

    return forkChild()
  }

  return execute
}
