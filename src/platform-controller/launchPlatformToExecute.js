import {
  createCancellationToken,
  cancellationTokenCompose,
  createOperation,
  createCancelError,
} from "@dmail/cancellation"
import { promiseTrackRace } from "../promiseHelper.js"
import { hotreloadOpen } from "./hotreload.js"
import {
  createRestartToken,
  restartTokenCompose,
  createRestartController,
  createRestartSource,
} from "./restartable.js"

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

  if (hotreload) {
    const hotreloadRestartController = createRestartController()
    cancellationToken.register(
      hotreloadOpen(hotreloadSSERoot, (fileChanged) => {
        hotreloadRestartController.restart(`file changed: ${fileChanged}`)
      }),
    )
    restartToken = restartTokenCompose(restartToken, hotreloadRestartController.token)
  }

  const restartSource = createRestartSource()
  restartSource.onopen = (reason) => {
    log(`open restart because ${reason}`)
  }
  restartSource.onclose = (reason) => {
    log(`close restart because ${reason}`)
  }
  restartToken.setRestartSource(restartSource)

  const platformCancellationToken = cancellationToken

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

      // if we cancel, prevent restart
      const restartCloseRegistration = cancellationToken.register(restartSource.close)
      restartSource.open((reason) => {
        restartCloseRegistration.unregister()
        return platformOperation.cancel(reason).then(startPlatform)
      })
      const restarting = new Promise((resolve) => {
        restartSource.onrestart = resolve
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
