import {
  createCancellationToken,
  cancellationTokenCompose,
  cancellationTokenToPromise,
  createOperation,
} from "@dmail/cancellation"
import { promiseTrackRace } from "../promiseHelper.js"
import { createRestartSignal } from "./restartController.js"

// when launchPlatform returns close/closeForce
// the launched platform have that amount of ms to close
// before we call closeForce
const ALLOCATED_MS_FOR_CLOSE = 10 * 60 * 10 * 1000

export const launchPlatformToExecuteFile = (
  launchPlatform,
  {
    cancellationToken = createCancellationToken(),
    platformTypeForLog = "platform", // should be 'node', 'chromium', 'firefox'
    verbose = false,
  } = {},
) => {
  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  const platformCancellationToken = cancellationToken

  const executeFile = (
    file,
    {
      cancellationToken = createCancellationToken(),
      restartSignal = createRestartSignal(),
      instrument = false,
      setup = () => {},
      teardown = () => {},
    } = {},
  ) => {
    const executionCancellationToken = cancellationTokenCompose(
      platformCancellationToken,
      cancellationToken,
    )

    const createPlatformClosedDuringExecutionError = () => {
      const error = new Error(`${platformTypeForLog} unexpectedtly closed while executing ${file}`)
      error.code = "PLATFORM_CLOSED_DURING_EXECUTION_ERROR"
      return error
    }

    const startPlatform = async () => {
      executionCancellationToken.throwIfRequested()

      log(`launch ${platformTypeForLog} to execute ${file}`)
      const { opened, closed, close, closeForce, fileToExecuted } = await launchPlatform()

      closed.catch((e) => {
        log(`${platformTypeForLog} error: ${e}`)
      })

      const platformOperation = createOperation({
        cancellationToken: executionCancellationToken,
        promise: opened,
        stop: (reason) => {
          log(`stop ${platformTypeForLog}`)
          close(reason)

          if (closeForce) {
            const id = setTimeout(closeForce, ALLOCATED_MS_FOR_CLOSE)
            closed.finally(() => clearTimeout(id))
          }
          return closed
        },
      })

      await platformOperation

      log(`execute ${file} on ${platformTypeForLog}`)
      const executed = fileToExecuted(file, { instrument, setup, teardown })

      // canceled will reject in case of cancellation
      const canceled = cancellationTokenToPromise(executionCancellationToken)

      const restarted = new Promise((resolve) => {
        restartSignal.onrestart = resolve
      })

      const { winner, value } = await promiseTrackRace([canceled, restarted, closed, executed])

      if (winner === restarted) {
        return platformOperation.stop(value).then(startPlatform)
      }

      if (winner === closed) {
        log(`${platformTypeForLog} closed`)
        return Promise.reject(createPlatformClosedDuringExecutionError())
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
