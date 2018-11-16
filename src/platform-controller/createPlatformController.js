import {
  createCancellationToken,
  cancellationTokenCompose,
  cancellationTokenToPromise,
} from "../cancellation/index.js"
import { hotreloadOpen } from "./hotreload.js"
import { createSignal } from "@dmail/signal"
import { promiseNamedRace } from "../promiseHelper.js"
import { memoizeOnce } from "../functionHelper.js"

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

  // by default restart do nothing
  let restartImplementation = () => Promise.resolve()
  const restart = memoizeOnce((reason) => restartImplementation(reason))
  const { remove } = fileChangedSignal.listen(({ file }) => {
    restart(`file changed: ${file}`)
  })
  cancellationToken.register(remove)

  const execute = ({
    cancellationToken = createCancellationToken(),
    file,
    instrument = false,
    setup = () => {},
    teardown = () => {},
  }) => {
    const executionCancellationToken = cancellationTokenCompose(
      platformCancellationToken,
      cancellationToken,
    )

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

      const stopped = Promise.race([errored, closed])

      const stop = memoizeOnce((reason) => {
        log(`stop ${platformTypeForLog}`)
        close(reason)
        if (closeForce) {
          const id = setTimeout(closeForce, ALLOCATED_MS_FOR_CLOSE)
          stopped.then(() => clearTimeout(id))
        }
        return stopped
      })
      // the platform will be started, cancellation must wait
      // for platform to close before considering cancellation is done
      // We listen for platformDead that will be resolved when platform dies
      const unregisterStopOnCancel = cancellationToken.register(stop)
      stopped.then(() => unregisterStopOnCancel())

      log("open restart")

      restart.deleteCache()
      const restarting = new Promise((resolve) => {
        restartImplementation = (reason) => {
          resolve()
          return stop(reason).then(startPlatform)
        }
      })
      cancellationToken.register(() => {
        restartImplementation = () => Promise.resolve()
      })

      log(`execute ${file} on ${platformTypeForLog}`)
      const { done } = executeFile(file, { instrument, setup, teardown })
      done.then((value) => {
        log(`${file} execution on ${platformTypeForLog} done with ${value}`)
      })
      promiseNamedRace({ errored, closed }).then(({ winner, value }) => {
        if (winner === errored) {
          log(`${platformTypeForLog} error: ${value}`)
        } else {
          log(`${platformTypeForLog} closed`)
        }
      })

      promiseNamedRace({ cancelled, restarting, errored, closed, done }).then(
        ({ winner, value }) => {
          // restarting is here to prevent reacting to errored/closed/done
          if (winner === restarting) {
            return
          }
          if (winner === errored) {
            executionReject(value)
            return
          }
          if (winner === closed) {
            const error = new Error(
              `${platformTypeForLog} unexpectedtly closed while executing ${file}`,
            )
            executionReject(error)
            return
          }
          if (winner === done) {
            // should I call child.disconnect() at some point ?
            // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect
            executionResolve(value)
            cancelled.register(close)
          }
        },
      )

      return currentExecutionPromise
    }
    startPlatform()

    return currentExecutionPromise
  }

  return execute
}
