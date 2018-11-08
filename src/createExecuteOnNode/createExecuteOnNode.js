import { fork } from "child_process"
import path from "path"
import { uneval } from "@dmail/uneval"
import { cancellationNone } from "../cancel/index.js"
import { registerEvent, eventRace } from "../eventHelper.js"
import { open } from "./hotreload.js"
import { createSignal } from "@dmail/signal"
import { createChildExecArgv } from "./createChildExecArgv.js"
import {
  createCloseDuringExecutionError,
  createCrashAfterExecutedError,
  createCrashAfterInterruptedError,
  createCrashAfterCancelError,
} from "./createChildError.js"

const root = path.resolve(__dirname, "../../../")
const nodeClientFile = `${root}/dist/src/createExecuteOnNode/client.js`

export const createExecuteOnNode = ({
  cancellation = cancellationNone,
  localRoot,
  remoteRoot,
  compileInto,
  hotreload = false,
  hotreloadSSERoot,
}) => {
  const fileChangedSignal = createSignal()
  if (hotreload) {
    const hotreloadPredicate = () => {
      // for now I don't know how parent
      // will decide what trigger hotreload vs what does not
      return true
    }

    cancellation.register(
      open(hotreloadSSERoot, (fileChanged) => {
        if (hotreloadPredicate(fileChanged)) {
          fileChangedSignal.emit(fileChanged)
        }
      }),
    )
  }

  const hotreloadRegister = (callback) => {
    const listener = fileChangedSignal.listen(callback)
    return () => listener.remove()
  }

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

    // once we have executed, we still listen for cancel, close, hotreload, restart
    // but we resolve only when child close
    let afterResolve
    let afterReject
    const afterPromise = new Promise((resolve, reject) => {
      afterResolve = resolve
      afterReject = reject
    })

    const forkChild = async () => {
      await cancellation.toPromise()
      const execArgv = await createChildExecArgv({ cancellation })

      const child = fork(nodeClientFile, { execArgv })
      log(`fork ${nodeClientFile} to execute ${file}`)

      const childMessageRegister = (callback) => registerEvent(child, "message", callback)

      const closeRegister = (callback) => registerEvent(child, "close", callback)

      // should i call child.disconnect at some point ?
      // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect

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

      const childInterrupt = () => {
        sendToChild("exit-please")
      }

      const closeAfterCancel = (reason) => {
        return new Promise((resolve, reject) => {
          closeRegister((code) => {
            if (code === 0 || code === null) {
              resolve(code)
            } else {
              reject(createCrashAfterCancelError(code))
            }
          })
          childInterrupt(reason)
        })
      }

      const restart = (reason) => {
        // if we first receive restart we fork a new child
        log(`restart because ${reason}: interrupt child`)
        childInterrupt(reason)
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
                  reject(createCrashAfterInterruptedError(code))
                }
              },
            },
          })
        })
      }

      const promise = new Promise((resolve, reject) => {
        eventRace({
          cancel: {
            register: cancellation.register,
            callback: closeAfterCancel,
          },
          close: {
            register: closeRegister,
            callback: (code) => {
              // child is not expected to close, we reject when it happens
              reject(createCloseDuringExecutionError(code))
            },
          },
          hotreload: {
            register: hotreloadRegister,
            callback: (file) => resolve(restart(`${file} changed`)),
          },
          restart: {
            register: restartRegister,
            callback: (reason) => resolve(restart(reason)),
          },
          execute: {
            register: (callback) => registerChildEvent("execute", callback),
            callback: (data) => {
              // no need to keep child connected
              // child.disconnect()
              resolve(data)
            },
          },
        })

        sendToChild("execute", {
          localRoot,
          remoteRoot,
          compileInto,

          file,
          instrument,
          setup,
          teardown,
        })
      })

      promise.then(() => {
        eventRace({
          cancel: {
            register: cancellation.register,
            callback: closeAfterCancel,
          },
          close: {
            register: closeRegister,
            callback: (code) => {
              if (code === 0 || code === null) {
                afterResolve()
              } else {
                afterReject(createCrashAfterExecutedError(code))
              }
            },
          },
          hotreload: {
            register: hotreloadRegister,
            callback: (file) => {
              restart(`${file} changed`)
            },
          },
          restart: {
            register: restartRegister,
            callback: (reason) => restart(reason),
          },
        })
      })

      promise.afterPromise = afterPromise

      return promise
    }

    const forkPromise = forkChild()
    forkPromise.afterPromise = afterPromise
    return forkPromise
  }

  return execute
}
