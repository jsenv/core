import { fork as forkChildProcess } from "child_process"
import path from "path"
import { uneval } from "@dmail/uneval"
import { cancellationNone } from "../cancel/index.js"
import { createChildExecArgv } from "./createChildExecArgv.js"
import {
  createScriptClosedError,
  createScriptClosedWithFailureCodeError,
} from "./createChildError.js"
import { fork, forkMatch, labelize, anyOf } from "../outcome/index.js"
import { hotreloadOpen } from "./hotreload.js"
import { createSignal } from "@dmail/signal"

// a forked process will have that amount of ms to exit
// when this process sends 'interrupt' event
const ALLOCATED_MS_FOR_INTERRUPTION = 10 * 60 * 10 * 1000

const root = path.resolve(__dirname, "../../../")
const nodeClientFile = `${root}/dist/src/createExecuteOnNode/client.js`

export const createExecuteOnNode = ({
  cancellation = cancellationNone,
  localRoot,
  remoteRoot,
  compileInto,
  hotreload = false,
  hotreloadSSERoot,
  restartStart = null,
  platformStart = null,
}) => {
  const fileChangedSignal = createSignal()

  cancellation.register(
    hotreloadOpen(hotreloadSSERoot, (fileChanged) => {
      fileChangedSignal.emit({ file: fileChanged })
    }),
  )

  const parentCancellation = cancellation

  const execute = ({
    cancellation = parentCancellation,
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

      let childProcessAlive = true
      let unregisterChildProcessCancellation
      let childProcessResolve
      let childProcessReject
      const childProcessPromise = new Promise((resolve, reject) => {
        childProcessResolve = (value) => {
          unregisterChildProcessCancellation()
          childProcessAlive = false
          resolve(value)
        }
        childProcessReject = (error) => {
          unregisterChildProcessCancellation()
          childProcessAlive = false
          reject(error)
        }
      })
      if (platformStart) {
        platformStart(childProcessPromise)
      }

      // now the child is forked, we must wait for it to close before considering
      // cancellation as done, we listen for cancelpromise
      // that will be resolved/rejected when child close or crash
      unregisterChildProcessCancellation = cancellation.register(() => childProcessPromise)

      const addChildMessageListener = (callback) => {
        const messageListener = ({ type, data }) => {
          callback({ type, data: eval(`(${data})`) })
        }
        child.on("message", messageListener)
        return () => {
          child.removeListener("message", messageListener)
        }
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

      const cancelled = (settle) => {
        return cancellation.register(settle)
      }

      const errored = (settle) => {
        return addChildMessageListener(({ type, data }) => {
          if (type === "error") {
            settle(data)
          }
        })
      }

      const crashed = (settle) => {
        const crashedListener = (code) => {
          if (code !== 0 && code !== null) {
            log(`child crashed with code ${code}`)
            settle(code)
          }
        }
        child.on("close", crashedListener)
        return () => child.removeListener("close", crashedListener)
      }

      const closed = (settle) => {
        const closedListener = (code) => {
          if (code === 0 || code === null) {
            settle()
          }
        }
        child.on("close", closedListener)
        return () => child.removeListener("close", closedListener)
      }

      const modified = (settle) => {
        const { remove } = fileChangedSignal.listen(({ file }) => {
          settle(file)
        })
        return remove
      }

      const done = (settle) => {
        return addChildMessageListener(({ type, data }) => {
          if (type === "done") {
            settle(data)
          }
        })
      }

      const sendInterrupt = () => {
        child.kill("SIGINT")
        const id = setTimeout(() => child.kill(), ALLOCATED_MS_FOR_INTERRUPTION)
        fork(anyOf(crashed, closed), () => {
          clearTimeout(id)
        })
      }

      const closeBecauseCancelled = (reason) => {
        sendInterrupt(reason)
      }

      const restartBecauseModified = (file) => {
        const reason = `file changed: ${file}`
        const restartPromise = childProcessPromise.then(forkChild)
        if (restartStart) {
          restartStart(restartPromise)
        }

        log(`restart because ${reason}`)
        if (childProcessAlive) {
          log(`restart: interrupt child, will restart once closed`)
          forkMatch(labelize({ errored, crashed, closed }), {
            errored: (error) => {
              log(`errored on closing`)
              childProcessReject(error)
            },
            crashed: (code) => {
              log(`crashed on closing`)
              childProcessReject(createScriptClosedWithFailureCodeError(code))
            },
            closed: () => {
              log(`closed`)
              childProcessResolve()
            },
            // modified is ignored
            // done is ignored
          })
          sendInterrupt(reason)
        }
      }

      const onStarted = () => {
        const onCancelledAfterStarted = (reason) => {
          closeBecauseCancelled(reason)
        }

        const onErroredAfterStarted = (error) => {
          childProcessReject(error)
          scriptReject(error)
          log("early error, will restart on filechange")
          fork(modified, restartBecauseModified)
        }

        const onCrashedAfterStarted = (code) => {
          const error = createScriptClosedWithFailureCodeError(code)
          childProcessReject(error)
          scriptReject(error)
          log("early crash, will restart on filechange")
          fork(modified, restartBecauseModified)
        }

        const onClosedAfterStarted = (code) => {
          const error = createScriptClosedError(code)
          childProcessReject(error)
          scriptReject(error)
          log("early close, will restart on filechange")
          fork(modified, restartBecauseModified)
        }

        const onModifiedAfterStarted = (file) => {
          restartBecauseModified(file)
        }

        const onDoneAfterStarted = (value) => {
          const onCancelledAfterDone = (reason) => {
            closeBecauseCancelled(reason)
          }

          const onErroredAfterDone = (error) => {
            childProcessReject(error)
            // if (platformError) platformError(error)

            log("error, will restart on filechange")
            fork(modified, restartBecauseModified)
          }

          const onCrashedAfterDone = (code) => {
            const error = createScriptClosedWithFailureCodeError(code)
            childProcessReject(error)
            // if (platformError) platformError(error)

            log("crash, will restart on filechange")
            fork(modified, restartBecauseModified)
          }

          const onClosedAfterDone = () => {
            childProcessResolve()
            log("close, will restart on filechange")
            fork(modified, restartBecauseModified)
          }

          const onModifiedAfterDone = (file) => {
            restartBecauseModified(file)
          }

          // should I call child.disconnect() at some point ?
          // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect
          scriptResolve(value)
          log("done, will restart on filechange")
          forkMatch(labelize({ cancelled, errored, crashed, closed, modified }), {
            cancelled: onCancelledAfterDone,
            errored: onErroredAfterDone,
            crashed: onCrashedAfterDone,
            closed: onClosedAfterDone,
            modified: onModifiedAfterDone,
          })
        }

        forkMatch(labelize({ cancelled, errored, crashed, closed, modified, done }), {
          cancelled: onCancelledAfterStarted,
          errored: onErroredAfterStarted,
          crashed: onCrashedAfterStarted,
          closed: onClosedAfterStarted,
          modified: onModifiedAfterStarted,
          done: onDoneAfterStarted,
        })
      }

      onStarted()
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
