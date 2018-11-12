import { fork as forkChildProcess } from "child_process"
import path from "path"
import { uneval } from "@dmail/uneval"
import { cancellationNone } from "../cancel/index.js"
import { createChildExecArgv } from "./createChildExecArgv.js"
import {
  createScriptClosedError,
  createScriptClosedWithFailureCodeError,
} from "./createChildError.js"
import { fork, forkMatch, labelize } from "../outcome/index.js"

// a forked process will have that amount of ms to exit
// when this process sends 'interrupt' event
const ALLOCATED_MS_FOR_INTERRUPTION = 10 * 1000

const root = path.resolve(__dirname, "../../../")
const nodeClientFile = `${root}/dist/src/createExecuteOnNode/client.js`

export const createExecuteOnNode = ({
  // cancellation = cancellationNone,
  localRoot,
  remoteRoot,
  compileInto,
  hotreload = false,
  hotreloadSSERoot,
  restartStart = null,
  platformError = null,
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

    let scriptResolve
    let scriptReject
    const scriptPromise = new Promise((resolve, reject) => {
      scriptResolve = resolve
      scriptReject = reject
    })

    const forkChild = async () => {
      await cancellation.toPromise()
      const execArgv = await createChildExecArgv({ cancellation })
      log(`fork ${nodeClientFile} to execute ${file}`)

      const child = forkChildProcess(nodeClientFile, { execArgv })

      const addChildMessageListener = (callback) => {
        const messageListener = ({ type, data }) => {
          callback({ type, data: eval(`(${data})`) })
        }
        return () => child.removeEventListener("message", messageListener)
      }

      const sendToChild = (type, data) => {
        const source = uneval(data, { showFunctionBody: true })
        log(`send to child ${type}: ${source}`)
        child.send({
          type,
          data: source,
        })
      }

      addChildMessageListener(({ type, data }) => {
        log(`receive message from child ${type}:${data}`)
      })

      const closed = (settle) => {
        // log(`child closed with code ${code}`)
        child.addEventListener("close", settle)
        return () => child.removeEventListener("close", settle)
      }

      const restartRequested = (settle) => {
        return addChildMessageListener(({ type, data }) => {
          if (type === "restart-request") {
            settle(data)
          }
        })
      }

      const done = (settle) => {
        return addChildMessageListener(({ type, data }) => {
          if (type === "done") {
            settle(data)
          }
        })
      }

      const errored = (settle) => {
        return addChildMessageListener(({ type, data }) => {
          if (type === "error") {
            settle(data)
          }
        })
      }

      let cancelResolve
      let cancelReject
      const cancelPromise = new Promise((resolve, reject) => {
        cancelResolve = resolve
        cancelReject = reject
      })

      const cancelled = (settle) => {
        return cancellation.register((reason) => {
          settle(reason)
          return cancelPromise
        })
      }

      const sendInterrupt = () => {
        sendToChild("interrupt")
        const id = setTimeout(() => child.kill(), ALLOCATED_MS_FOR_INTERRUPTION)
        fork(closed, () => {
          clearTimeout(id)
        })
      }

      const restart = (reason) => {
        // if we first receive restart we fork a new child
        log(`restart because ${reason}: interrupt child`)
        sendInterrupt(reason)
        log(`restart second step: wait for child to close`)

        return new Promise((resolve, reject) => {
          forkMatch(labelize({ cancelled, closed }), {
            cancelled: (reason) => {
              log(`restart cancelled because ${reason}`)
              // we have nothing to do, the child will close
              // and we won't fork a new one
            },
            closed: (code) => {
              log(`restart last step: child closed with ${code}`)
              if (code === 0 || code === null) {
                resolve(forkChild())
              } else {
                reject(createScriptClosedWithFailureCodeError(code))
              }
            },
          })
        })
      }

      const onScriptResolve = () => {
        forkMatch(labelize({ cancelled, closed, restartRequested }), {
          cancelled: () => {
            sendInterrupt()
            fork(closed, (code) => {
              if (code === 0 || code === null) {
                cancelResolve(code)
              } else {
                const error = createScriptClosedWithFailureCodeError(code)
                cancelReject(error)
                if (platformError) platformError(error)
              }
            })
          },
          restartRequested: (reason) => {
            if (restartStart) {
              restartStart(restart(reason))
            } else {
              restart(reason)
            }
          },
          closed: (code) => {
            const error = createScriptClosedError(code)
            if (platformError) platformError(error)
            else throw error
          },
        })
      }

      forkMatch(labelize({ cancelled, closed, restartRequested, errored, done }), {
        cancelled: () => {
          sendInterrupt()
          fork(closed, (code) => {
            if (code === 0 || code === null) {
              scriptResolve(code)
              cancelResolve(code)
            } else {
              const error = createScriptClosedWithFailureCodeError(code)
              scriptReject(error)
              cancelReject(error)
            }
          })
        },
        closed: (code) => {
          // child is not expected to close, we reject when it happens
          scriptReject(createScriptClosedError(code))
        },
        restartRequested: (reason) => {
          restart(reason).then((data) => {
            scriptResolve(data)
            onScriptResolve()
          })
        },
        errored: (error) => {
          scriptReject(error)
        },
        done: (value) => {
          // should I call child.disconnect() at some point ?
          // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect
          scriptResolve(value)
          onScriptResolve()
        },
      })

      sendToChild("execute", {
        localRoot,
        remoteRoot,
        compileInto,
        hotreload,
        hotreloadSSERoot,

        file,
        instrument,
        setup,
        teardown,
      })

      return scriptPromise
    }

    return forkChild()
  }

  return execute
}
