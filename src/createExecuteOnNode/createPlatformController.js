import { fork, forkMatch, labelize, anyOf } from "../outcome/index.js"
import { cancellationNone } from "../cancel/index.js"
import { hotreloadOpen } from "./hotreload.js"
import { createSignal } from "@dmail/signal"

// when launchPlatform returns close/closeForce
// the launched platform have that amount of ms to close
// before we call closeForce
const ALLOCATED_MS_FOR_CLOSE = 10 * 60 * 10 * 1000

export const createPlatformController = ({
  cancellation = cancellationNone,
  platformTypeForLog = "platform", // should be 'node', 'chromium', 'firefox'
  hotreload = false,
  hotreloadSSERoot,
  launchPlatform,
  verbose = false,
}) => {
  const fileChangedSignal = createSignal()

  if (hotreload) {
    cancellation.register(
      hotreloadOpen(hotreloadSSERoot, (fileChanged) => {
        fileChangedSignal.emit({ file: fileChanged })
      }),
    )
  }

  const controllerCancellation = cancellation

  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  const cancelled = (settle) => {
    return cancellation.register(settle)
  }

  const modified = (settle) => {
    const { remove } = fileChangedSignal.listen(({ file }) => {
      settle(file)
    })
    return remove
  }

  const execute = ({
    cancellation = controllerCancellation,
    file,
    instrument = false,
    setup = () => {},
    teardown = () => {},
  }) => {
    let scriptResolve
    let scriptReject
    const scriptPromise = new Promise((resolve, reject) => {
      scriptResolve = resolve
      scriptReject = reject
    })

    const startPlatform = async () => {
      await cancellation.toPromise()
      log(`start ${platformTypeForLog} to execute ${file}`)

      let unregisterPlatformCancellation
      let platformAlive = true
      let platformResolve
      let platformReject
      const platformPromise = new Promise((resolve, reject) => {
        platformResolve = (value) => {
          unregisterPlatformCancellation()
          platformAlive = false
          resolve(value)
        }
        platformReject = (error) => {
          unregisterPlatformCancellation()
          platformAlive = false
          reject(error)
        }
      })
      // the platform will be started, cancellation must wait
      // for platform to close before considering cancellation is done
      // We listen for platformPromise that will be resolved/rejected on platform
      // close or error
      unregisterPlatformCancellation = cancellation.register(() => platformPromise)

      const { errored, closed, done, close, closeForce, executeFile } = await launchPlatform({
        cancellation,
        scriptResolve,
        scriptReject,
      })

      const stop = (reason) => {
        log(`stop ${platformTypeForLog}`)
        close(reason)
        if (closeForce) {
          const id = setTimeout(closeForce, ALLOCATED_MS_FOR_CLOSE)
          fork(anyOf(errored, closed), () => {
            clearTimeout(id)
          })
        }
      }

      const restartAfterModified = (file) => {
        const reason = `file changed: ${file}`
        log(`${platformTypeForLog} restart because ${reason}`)

        platformPromise.then(startPlatform)
        if (platformAlive) {
          forkMatch(labelize({ errored, closed }), {
            errored: platformReject,
            closed: platformResolve,
            // modified is ignored
            // done is ignored
          })
          stop(reason)
        }
      }

      const onCancelledAfterStarted = (reason) => {
        stop(reason)
      }

      const onErroredAfterStarted = (error) => {
        platformReject(error)
        scriptReject(error)
        log("will restart on filechange")
        fork(modified, restartAfterModified)
      }

      const onClosedAfterStarted = () => {
        const error = new Error(
          `${platformTypeForLog} unexpectedtly closed while executing ${file}`,
        )
        platformReject(error)
        scriptReject(error)
        log("will restart on filechange")
        fork(modified, restartAfterModified)
      }

      const onModifiedAfterStarted = (file) => {
        restartAfterModified(file)
      }

      const onDoneAfterStarted = (value) => {
        const onCancelledAfterDone = (reason) => {
          close(reason)
        }

        const onErroredAfterDone = (error) => {
          platformReject(error)
          log("will restart on filechange")
          fork(modified, restartAfterModified)
        }

        const onClosedAfterDone = () => {
          platformResolve()
          log("will restart on filechange")
          fork(modified, restartAfterModified)
        }

        const onModifiedAfterDone = (file) => {
          restartAfterModified(file)
        }

        // should I call child.disconnect() at some point ?
        // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect
        scriptResolve(value)
        log("will restart on filechange")
        forkMatch(labelize({ cancelled, errored, closed, modified }), {
          cancelled: onCancelledAfterDone,
          errored: onErroredAfterDone,
          closed: onClosedAfterDone,
          modified: onModifiedAfterDone,
        })
      }

      forkMatch(labelize({ cancelled, errored, closed, modified, done }), {
        cancelled: onCancelledAfterStarted,
        errored: onErroredAfterStarted,
        closed: onClosedAfterStarted,
        modified: onModifiedAfterStarted,
        done: onDoneAfterStarted,
      })

      log(`execute ${file} on ${platformTypeForLog}`)
      forkMatch(labelize({ errored, closed }), {
        errored: (error) => {
          log(`${platformTypeForLog} error: ${error}`)
        },
        closed: () => {
          log(`${platformTypeForLog} closed`)
        },
      })
      fork(done, (value) => {
        log(`${file} execution on ${platformTypeForLog} done with ${value}`)
      })
      executeFile(file, { instrument, setup, teardown })

      return scriptPromise
    }

    return startPlatform()
  }

  return execute
}
