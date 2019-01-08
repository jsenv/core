import {
  createCancellationToken,
  createOperation,
  createStoppableOperation,
} from "@dmail/cancellation"
import { promiseTrackRace } from "../promiseHelper.js"
import { createRestartSignal } from "./restartController.js"

// when launchPlatform returns close/closeForce
// the launched platform have that amount of ms to close
// before we call closeForce
const ALLOCATED_MS_FOR_CLOSE = 10 * 60 * 10 * 1000

export const executeFileOnPlatform = (
  file,
  launchPlatform,
  {
    cancellationToken = createCancellationToken(),
    restartSignal = createRestartSignal(),
    platformTypeForLog = "platform", // should be 'node', 'chromium', 'firefox'
    verbose = false,
    stopOnceExecuted = false,
    ...rest
  } = {},
) => {
  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  const startPlatform = async () => {
    log(`launch ${platformTypeForLog} to execute ${file}`)
    const launchOperation = createStoppableOperation({
      cancellationToken,
      start: () => launchPlatform(),
      stop: ({ close, closeForce }) => {
        log(`stop ${platformTypeForLog}`)
        close()

        if (closeForce) {
          const id = setTimeout(closeForce, ALLOCATED_MS_FOR_CLOSE)
          closed.finally(() => clearTimeout(id))
        }
        return closed
      },
    })
    const { openDetail, errored, disconnected, closed, fileToExecuted } = await launchOperation
    log(`${platformTypeForLog} opened ${JSON.stringify(openDetail)}`)

    log(`execute ${file} on ${platformTypeForLog}`)
    const executeOperation = createOperation({
      cancellationToken,
      start: async () => {
        const restarted = new Promise((resolve) => {
          restartSignal.onrestart = resolve
        })
        const executed = fileToExecuted(file, rest)

        const { winner, value } = await promiseTrackRace([
          errored,
          disconnected,
          closed,
          restarted,
          executed,
        ])

        if (winner === errored) {
          throw value
        }

        if (winner === disconnected) {
          throw createDisconnectedDuringExecutionError(file, platformTypeForLog)
        }

        if (winner === closed) {
          throw createClosedDuringExecutionError(file, platformTypeForLog)
        }

        if (winner === restarted) {
          return launchOperation.stop(value).then(startPlatform)
        }

        log(`${file} execution on ${platformTypeForLog} done with ${value}`)
        disconnected.then(() => {
          log(`${platformTypeForLog} disconnected`)
        })
        closed.then(() => {
          log(`${platformTypeForLog} closed`)
        })

        if (stopOnceExecuted) {
          launchOperation.stop("stopOnceExecuted")
        }

        return value
      },
    })
    return executeOperation
  }

  return startPlatform()
}

const createDisconnectedDuringExecutionError = (file, platformType) => {
  const error = new Error(`${platformType} disconnected while executing ${file}`)
  error.code = "PLATFORM_DISCONNECTED_DURING_EXECUTION_ERROR"
  return error
}

const createClosedDuringExecutionError = (file, platformType) => {
  const error = new Error(`${platformType} unexpectedtly closed while executing ${file}`)
  error.code = "PLATFORM_CLOSED_DURING_EXECUTION_ERROR"
  return error
}
