import {
  createCancellationToken,
  cancellationTokenCompose,
  cancellationTokenToPromise,
} from "../cancellation/index.js"
import { createRestartSource, createRestartToken, restartTokenCompose } from "../restart/index.js"
import { hotreloadOpen } from "./hotreload.js"
import { createSignal } from "@dmail/signal"
import { namedPromiseMatch } from "../promiseHelper.js"

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

    const cancelled = executionCancellationToken.toRequestedPromise()

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
      await cancellationTokenToPromise(cancellationToken)

      log(`start ${platformTypeForLog} to execute ${file}`)

      const { errored, closed, close, closeForce, executeFile } = await launchPlatform()

      const platformDead = Promise.race([errored, closed])

      // the platform will be started, cancellation must wait
      // for platform to close before considering cancellation is done
      // We listen for platformDead that will be resolved when platform dies
      const unregisterPlatformCancellation = cancellationToken.register(() => platformDead)
      platformDead.then(() => unregisterPlatformCancellation())

      const stop = (reason) => {
        log(`stop ${platformTypeForLog}`)
        close(reason)
        if (closeForce) {
          const id = setTimeout(closeForce, ALLOCATED_MS_FOR_CLOSE)
          platformDead.then(() => clearTimeout(id))
        }
      }

      log("open restart")
      const closeRestart = restartToken.open((reason) => {
        log(`${platformTypeForLog} restart because ${reason}`)

        if (platformDead.isSettled() === false) {
          stop(reason)
        }

        return platformDead.then(startPlatform)
      })
      cancellationToken.register((reason) => {
        log(`close restart because ${reason}`)
        return closeRestart(reason)
      })
      const restarted = restartToken.toRequestedPromise()

      const onCancelledAfterStarted = (reason) => {
        stop(reason)
      }

      const onErroredAfterStarted = (error) => {
        executionReject(error)
      }

      const onClosedAfterStarted = () => {
        const error = new Error(
          `${platformTypeForLog} unexpectedtly closed while executing ${file}`,
        )
        executionReject(error)
      }

      const onDoneAfterStarted = (value) => {
        // should I call child.disconnect() at some point ?
        // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect
        executionResolve(value)
        cancelled.register(close)
      }

      log(`execute ${file} on ${platformTypeForLog}`)
      namedPromiseMatch(
        { errored, closed },
        {
          errored: (error) => {
            log(`${platformTypeForLog} error: ${error}`)
          },
          closed: () => {
            log(`${platformTypeForLog} closed`)
          },
        },
      )
      const { done } = executeFile(file, { instrument, setup, teardown })
      done.register((value) => {
        log(`${file} execution on ${platformTypeForLog} done with ${value}`)
      })
      namedPromiseMatch(
        { cancelled, restarted, errored, closed, done },
        {
          cancelled: onCancelledAfterStarted,
          // restarted is here to prevent reacting to errored/closed/done
          restarted: null,
          errored: onErroredAfterStarted,
          closed: onClosedAfterStarted,
          done: onDoneAfterStarted,
        },
      )

      return currentExecutionPromise
    }
    startPlatform()

    return currentExecutionPromise
  }

  return execute
}
