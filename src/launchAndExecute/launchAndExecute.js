import {
  createCancellationToken,
  createOperation,
  createStoppableOperation,
} from "@dmail/cancellation"
import { promiseTrackRace } from "@dmail/helper"
import { createRestartSignal } from "./restartController.js"

// when launchPlatform returns { disocnnected, stop, stopForce }
// the launched platform have that amount of ms for disconnected to resolve
// before we call stopForce
const ALLOCATED_MS_BEFORE_FORCE_STOP = 10 * 60 * 10 * 1000

export const launchAndExecute = (
  launchPlatform,
  file,
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
      stop: ({ stop, stopForce }) => {
        log(`stop ${platformTypeForLog}`)
        stop()

        if (stopForce) {
          const id = setTimeout(stopForce, ALLOCATED_MS_BEFORE_FORCE_STOP)
          disconnected.finally(() => clearTimeout(id))
        }
        return disconnected
      },
    })
    const { options, errored, disconnected, fileToExecuted } = await launchOperation
    log(`${platformTypeForLog} started ${JSON.stringify(options)}`)

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
          restarted,
          executed,
        ])

        if (winner === errored) {
          throw value
        }

        if (winner === disconnected) {
          throw createDisconnectedDuringExecutionError(file, platformTypeForLog)
        }

        if (winner === restarted) {
          return launchOperation.stop(value).then(startPlatform)
        }

        log(`${file} execution on ${platformTypeForLog} done with ${value}`)
        errored.then((value) => {
          throw value
        })
        disconnected.then(() => {
          log(`${platformTypeForLog} disconnected`)
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
