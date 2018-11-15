import { fork, forkMatch, labelize, anyOf } from "../outcome/index.js"
import { createCancellationToken, cancellationTokenCompose } from "../cancellation-source/index.js"
import { createRestartSource, createRestartToken, restartTokenCompose } from "../restart/index.js"
import { hotreloadOpen } from "./hotreload.js"
import { createSignal } from "@dmail/signal"

// when launchPlatform returns close/closeForce
// the launched platform have that amount of ms to close
// before we call closeForce
const ALLOCATED_MS_FOR_CLOSE = 10 * 60 * 10 * 1000

export const createPlatformController = ({
  cancellationToken = createCancellationToken(),
  platformTypeForLog = "platform", // should be 'node', 'chromium', 'firefox'
  hotreload = false,
  hotreloadSSERoot,
  launchPlatform,
  verbose = false,
}) => {
  const fileChangedSignal = createSignal()

  if (hotreload) {
    cancellationToken.register(
      hotreloadOpen(hotreloadSSERoot, (fileChanged) => {
        fileChangedSignal.emit({ file: fileChanged })
      }),
    )
  }

  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  const platformCancellationToken = cancellationToken

  const hotreloadRestartSource = createRestartSource()
  fileChangedSignal.listen(({ file }) => {
    hotreloadRestartSource.restart(`file changed: ${file}`)
  })
  const platformRestartToken = hotreloadRestartSource.token

  const execute = ({
    cancellationToken = createCancellationToken(),
    restartToken = createRestartToken(),
    file,
    instrument = false,
    setup = () => {},
    teardown = () => {},
  }) => {
    const executionCancellationToken = cancellationTokenCompose(
      platformCancellationToken,
      cancellationToken,
    )
    restartToken = restartTokenCompose(platformRestartToken, restartToken)

    const cancelled = (settle) => {
      return executionCancellationToken.register(settle)
    }

    let currentExecutionResolve
    let currentExecutionReject
    let currentExecutionPromise
    const nextExecutionPromise = () => {
      currentExecutionPromise = new Promise((resolve, reject) => {
        currentExecutionResolve = resolve
        currentExecutionReject = reject
      })
    }
    const executionResolve = (value) => {
      currentExecutionResolve(value)
      nextExecutionPromise()
    }
    const executionReject = (error) => {
      currentExecutionReject(error)
      nextExecutionPromise()
    }
    nextExecutionPromise()

    const startPlatform = async () => {
      await cancellationToken.toPromise()
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
      unregisterPlatformCancellation = cancellationToken.register(() => platformPromise)

      const { errored, closed, close, closeForce, executeFile } = await launchPlatform()

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

      log("open restart")
      const closeRestart = restartToken.open((reason) => {
        log(`${platformTypeForLog} restart because ${reason}`)

        const restartExecutionPromise = platformPromise.then(startPlatform)

        if (platformAlive) {
          forkMatch(labelize({ errored, closed }), {
            errored: platformReject,
            closed: platformResolve,
            // modified is ignored
            // done is ignored
          })
          stop(reason)
        }

        return restartExecutionPromise
      })
      cancellationToken.register((reason) => {
        log(`close restart because ${reason}`)
        return closeRestart(reason)
      })
      const restarted = (settle) => {
        return restartToken.register(settle)
      }

      const onCancelledAfterStarted = (reason) => {
        stop(reason)
      }

      const onErroredAfterStarted = (error) => {
        platformReject(error)
        executionReject(error)
      }

      const onClosedAfterStarted = () => {
        const error = new Error(
          `${platformTypeForLog} unexpectedtly closed while executing ${file}`,
        )
        platformReject(error)
        executionReject(error)
      }

      const onDoneAfterStarted = (value) => {
        const onCancelledAfterDone = (reason) => {
          close(reason)
        }

        const onErroredAfterDone = (error) => {
          platformReject(error)
        }

        const onClosedAfterDone = () => {
          platformResolve()
        }

        // should I call child.disconnect() at some point ?
        // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect
        executionResolve(value)
        forkMatch(labelize({ cancelled, errored, closed, restarted }), {
          cancelled: onCancelledAfterDone,
          errored: onErroredAfterDone,
          closed: onClosedAfterDone,
          restarted: () => {},
        })
      }

      log(`execute ${file} on ${platformTypeForLog}`)
      forkMatch(labelize({ errored, closed }), {
        errored: (error) => {
          log(`${platformTypeForLog} error: ${error}`)
        },
        closed: () => {
          log(`${platformTypeForLog} closed`)
        },
      })
      const { done } = executeFile(file, { instrument, setup, teardown })
      fork(done, (value) => {
        log(`${file} execution on ${platformTypeForLog} done with ${value}`)
      })
      forkMatch(labelize({ cancelled, errored, closed, restarted, done }), {
        cancelled: onCancelledAfterStarted,
        errored: onErroredAfterStarted,
        closed: onClosedAfterStarted,
        restarted: () => {},
        done: onDoneAfterStarted,
      })

      return currentExecutionPromise
    }
    startPlatform()

    return currentExecutionPromise
  }

  return execute
}
