import { createCancellationToken, createOperation } from "@dmail/cancellation"
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
    log(`launch ${platformTypeForLog} to execute ${file}`)
    const platformOperation = createOperation({
      cancellationToken,
      start: () => launchPlatform(),
      stop: ({ close, closeForce }) => {
        // if we are disconnected we can't act on the platform anymore
        log(`stop ${platformTypeForLog}`)
        close()

        if (closeForce) {
          const id = setTimeout(closeForce, ALLOCATED_MS_FOR_CLOSE)
          closed.finally(() => clearTimeout(id))
        }
        return closed
      },
    })
    const { disconnected, errored, closed, fileToExecuted } = await platformOperation
    log(`${platformTypeForLog} opened`)

    log(`execute ${file} on ${platformTypeForLog}`)
    const executeOperation = createOperation({
      cancellationToken,
      start: async () => {
        const restarted = new Promise((resolve) => {
          restartSignal.onrestart = resolve
        })
        const executed = fileToExecuted(file, rest)

        const { winner, value } = await promiseTrackRace([
          disconnected,
          errored,
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
      },
      stop: () => {},
    })
    return executeOperation
  }

  return startPlatform()
}

const createDisconnectedError = () => {
  return new Error(`platform disconnected`)
}
