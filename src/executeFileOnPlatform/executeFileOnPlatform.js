import {
  createCancellationToken,
  cancellationTokenToPromise,
  createOperation,
} from "@dmail/cancellation"
import { promiseTrackRace } from "../promiseHelper.js"
import { createRestartSignal } from "./restartController.js"

// when launchPlatform returns close/closeForce
// the launched platform have that amount of ms to close
// before we call closeForce
const ALLOCATED_MS_FOR_CLOSE = 10 * 60 * 10 * 1000

export const executeFileOnPlatform = (
  file,
  {
    launchPlatform,
    cancellationToken = createCancellationToken(),
    restartSignal = createRestartSignal(),
    platformTypeForLog = "platform", // should be 'node', 'chromium', 'firefox'
    verbose = false,
    ...rest
  } = {},
) => {
  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  const createPlatformClosedDuringExecutionError = () => {
    const error = new Error(`${platformTypeForLog} unexpectedtly closed while executing ${file}`)
    error.code = "PLATFORM_CLOSED_DURING_EXECUTION_ERROR"
    return error
  }

  const startPlatform = async () => {
    cancellationToken.throwIfRequested()

    log(`launch ${platformTypeForLog} to execute ${file}`)
    const {
      disconnected,
      errored,
      opened,
      closed,
      close,
      closeForce,
      fileToExecuted,
    } = await launchPlatform()

    const platformOperation = createOperation({
      cancellationToken,
      promise: new Promise(async (resolve) => {
        const { winner, value } = await promiseTrackRace([disconnected, errored, opened])
        if (winner === disconnected) {
          log(`${platformTypeForLog} disconnected`)
          throw createDisconnectedError()
        }

        if (winner === errored) {
          throw value
        }

        resolve()
      }),
      stop: (reason) => {
        // if we are disconnected we can't act on the platform anymore
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
    log(`${platformTypeForLog} opened`)

    // canceled will reject in case of cancellation
    const canceled = cancellationTokenToPromise(cancellationToken)

    const restarted = new Promise((resolve) => {
      restartSignal.onrestart = resolve
    })

    log(`execute ${file} on ${platformTypeForLog}`)
    const executed = fileToExecuted(file, rest)

    const { winner, value } = await promiseTrackRace([
      disconnected,
      errored,
      canceled,
      restarted,
      closed,
      executed,
    ])

    if (winner === disconnected) {
      log(`${platformTypeForLog} disconnected`)
      throw createDisconnectedError()
    }

    if (winner === errored) {
      throw value
    }

    if (winner === restarted) {
      return platformOperation.stop(value).then(startPlatform)
    }

    if (winner === closed) {
      return Promise.reject(createPlatformClosedDuringExecutionError())
    }

    log(`${file} execution on ${platformTypeForLog} done with ${value}`)
    closed.then(() => {
      log(`${platformTypeForLog} closed`)
    })
    return value
  }

  return startPlatform()
}

const createDisconnectedError = () => {
  return new Error(`platform disconnected`)
}
