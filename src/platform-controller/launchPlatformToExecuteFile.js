import {
  createCancellationToken,
  cancellationTokenCompose,
  createOperation,
  createCancelError,
} from "@dmail/cancellation"
import { promiseTrackRace } from "../promiseHelper.js"
import { hotreloadOpen } from "./hotreload.js"
import { createRestartSource, createRestartToken, createRestartable } from "./restartable.js"

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

export const launchPlatformToExecuteFile = (
  launchPlatform,
  {
    cancellationToken = createCancellationToken(),
    restartToken = createRestartToken(),
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

  const restartable = createRestartable()
  restartable.onopen = (reason) => {
    log(`open restart because ${reason}`)
  }
  restartable.onclose = (reason) => {
    log(`close restart because ${reason}`)
  }
  restartable.addToken(restartToken)

  if (hotreload) {
    const hotreloadRestartSource = createRestartSource()
    cancellationToken.register(
      hotreloadOpen(hotreloadSSERoot, (fileChanged) => {
        hotreloadRestartSource.restart(`file changed: ${fileChanged}`)
      }),
    )
    restartable.addToken(hotreloadRestartSource.token)
  }

  const platformCancellationToken = cancellationToken

  const executeFile = (
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
      const { started, errored, closed, close, closeForce, fileToExecuted } = await launchPlatform()

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

      // if we cancel, prevent restart
      const restartCloseRegistration = cancellationToken.register(restartable.close)
      restartable.open((reason) => {
        restartCloseRegistration.unregister()
        return platformOperation.cancel(reason).then(startPlatform)
      })
      const restarting = new Promise((resolve) => {
        restartable.onrestart(resolve)
      })

      await platformOperation

      log(`execute ${file} on ${platformTypeForLog}`)
      const executed = fileToExecuted(file, { instrument, setup, teardown })

      const { winner, value } = await promiseTrackRace([
        // cancellationTokenToPromise will reject with a cancelError to prevent
        // and prevent other promise to happen
        cancellationTokenToPromise(executionCancellationToken),
        restarting,
        errored,
        closed,
        executed,
      ])

      if (winner === restarting) {
        return value.restartReturnValue
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
      // executed
      // should I call child.disconnect() at some point ?
      // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect
      log(`${file} execution on ${platformTypeForLog} done with ${value}`)
      return value
    }

    return startPlatform()
  }

  return executeFile
}
