import {
  createCancellationToken,
  cancellationTokenCompose,
  createOperation,
  createCancelError,
} from "@dmail/cancellation"
import { promiseTrackRace } from "../promiseHelper.js"
import { memoizeOnce } from "../functionHelper.js"
import { hotreloadOpen } from "./hotreload.js"

// when launchPlatform returns close/closeForce
// the launched platform have that amount of ms to close
// before we call closeForce
const ALLOCATED_MS_FOR_CLOSE = 10 * 60 * 10 * 1000

const cancellationTokenToPromise = (cancellationToken) => {
  return new Promise((reoslve, reject) => {
    cancellationToken.throwIfRequested()
    const rejectRegistration = cancellationToken.register((reason) => {
      rejectRegistration.unregister()
      reject(createCancelError(reason))
    })
  })
}

export const launchPlatformToExecute = (
  launchPlatform,
  {
    cancellationToken = createCancellationToken(),
    platformTypeForLog = "platform", // should be 'node', 'chromium', 'firefox'
    hotreload = false,
    hotreloadSSERoot,
    verbose = false,
  } = {},
) => {
  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  const platformCancellationToken = cancellationToken

  // by default restart do nothing
  let restartImplementation = () => Promise.resolve()
  const restartClose = (reason) => {
    log("close restart")
    restartImplementation = () => Promise.resolve()
    return `closing restart because ${reason}`
  }
  const restart = memoizeOnce((reason) => {
    const fn = restartImplementation
    restartClose("restarting")
    return fn(reason)
  })
  // calling restartOpen means next call to restart will call a new function once
  // if you close, restart goes back to doing nothing
  const restartOpen = (implementation) => {
    log("open restart")
    restart.deleteCache()
    restartImplementation = implementation
    return restartClose
  }
  if (hotreload) {
    cancellationToken.register(
      hotreloadOpen(hotreloadSSERoot, (fileChanged) => {
        restart(`file changed: ${fileChanged}`)
      }),
    )
  }

  const execute = (
    file,
    {
      cancellationToken = createCancellationToken(),
      instrument = false,
      setup = () => {},
      teardown = () => {},
    } = {},
  ) => {
    const executionCancellationToken = cancellationTokenCompose(
      platformCancellationToken,
      cancellationToken,
    )

    const startPlatform = async () => {
      executionCancellationToken.throwIfRequested()

      log(`start ${platformTypeForLog} to execute ${file}`)
      const { started, errored, closed, close, closeForce, executeFile } = await launchPlatform()

      const platformOperation = createOperation({
        cancellationToken: executionCancellationToken,
        promise: started,
        stop: (reason) => {
          log(`stop ${platformTypeForLog}`)
          close(reason)

          const stopped = Promise.race([errored, closed])
          if (closeForce) {
            const id = setTimeout(closeForce, ALLOCATED_MS_FOR_CLOSE)
            stopped.then(() => clearTimeout(id))
          }
          return stopped
        },
      })

      let restartPromise
      const restarting = new Promise((resolve) => {
        // if we cancel, prevent restart
        const restartCloseRegistration = cancellationToken.register(restartClose)

        restartOpen((reason) => {
          restartCloseRegistration.unregister()
          resolve(reason)
          restartPromise = platformOperation.cancel(reason).then(startPlatform)
          return restartPromise
        })
      })

      await platformOperation

      log(`execute ${file} on ${platformTypeForLog}`)
      const { fileExecuted } = executeFile(file, { instrument, setup, teardown })

      const { winner, value } = await promiseTrackRace([
        // cancellationTokenToPromise will reject with a cancelError to prevent
        // and prevent other promise to happen
        cancellationTokenToPromise(executionCancellationToken),
        restarting,
        errored,
        closed,
        fileExecuted,
      ])

      if (winner === restarting) {
        return restartPromise
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
      // fileExecuted
      // should I call child.disconnect() at some point ?
      // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect
      log(`${file} execution on ${platformTypeForLog} done with ${value}`)
      return value
    }

    return startPlatform()
  }

  return execute
}
