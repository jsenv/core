import {
  createCancellationToken,
  cancellationTokenCompose,
  cancellationTokenToPromise,
  cancellationTokenWrapPromise,
} from "../cancellation/index.js"
import { hotreloadOpen } from "./hotreload.js"
import { promiseTrackRace } from "../promiseHelper.js"
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
  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  const platformCancellationToken = cancellationToken

  // by default restart do nothing
  let restartImplementation = () => Promise.resolve()
  const restart = memoizeOnce((reason) => restartImplementation(reason))
  // calling restartOpen means next call to restart will call a new function once
  // if you close, restart goes back to doing nothing
  const restartOpen = (implementation) => {
    restart.deleteCache()
    restartImplementation = implementation
    return () => {
      restartImplementation = () => Promise.resolve()
    }
  }
  if (hotreload) {
    cancellationToken.register(
      hotreloadOpen(hotreloadSSERoot, (fileChanged) => {
        restart(`file changed: ${fileChanged}`)
      }),
    )
  }

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

    const startPlatform = async () => {
      await cancellationTokenToPromise(executionCancellationToken)

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
      const unregisterStopOnCancel = executionCancellationToken.register(stop)
      stopped.then(unregisterStopOnCancel)

      const restarting = new Promise((resolve) => {
        log("open restart")
        const restartClose = restartOpen((reason) => {
          resolve()
          return stop(reason).then(startPlatform)
        })
        stopped.then(() => restartClose())
      })

      log(`execute ${file} on ${platformTypeForLog}`)
      const { done } = executeFile(file, { instrument, setup, teardown })

      const { winner, value } = await cancellationTokenWrapPromise(
        executionCancellationToken,
        promiseTrackRace([restarting, errored, closed, done]),
      )

      // restarting is here to prevent reacting to errored/closed/done
      if (winner === restarting) {
        return restart() // returns memoized promise of restart
      }
      if (winner === errored) {
        log(`${platformTypeForLog} error: ${value}`)
        return Promise.reject(value)
      }
      if (winner === closed) {
        log(`${platformTypeForLog} closed`)
        return Promise.reject(
          new Error(`${platformTypeForLog} unexpectedtly closed while executing ${file}`),
        )
      }
      // done
      // should I call child.disconnect() at some point ?
      // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect
      log(`${file} execution on ${platformTypeForLog} done with ${value}`)
      return value
    }

    return startPlatform()
  }

  return execute
}
