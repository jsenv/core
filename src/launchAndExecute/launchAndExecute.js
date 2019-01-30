import {
  createCancellationToken,
  createOperation,
  createStoppableOperation,
} from "@dmail/cancellation"
import { promiseTrackRace } from "@dmail/helper"
import "../promise-finally.js"
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
    // stopOnceExecuted false by default because you want to keep browser alive
    // or nodejs process
    // however unit test will pass true because they want to move on
    stopOnceExecuted = false,
    // stopOnError is false by default because it's better to keep process/browser alive
    // to debug the error to the its consequences
    // however unit test will pass true because they want to move on
    stopOnError = false,
    errorCallback = (error) => {
      console.log(`${platformTypeForLog} error ${error.stack}`)
    },
    disconnectCallback = () => {
      console.log(`${platformTypeForLog} disconnected`)
    },
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

    const onError = (error) => {
      errorCallback(error)
      if (stopOnError) {
        launchOperation.stop("stopOnError")
      }
    }

    log(`execute ${file} on ${platformTypeForLog}`)
    const executeOperation = createOperation({
      cancellationToken,
      start: async () => {
        const restarted = new Promise((resolve) => {
          restartSignal.onrestart = resolve
        })

        const executed = fileToExecuted(file, rest)
        const executionCompleted = new Promise((resolve) => {
          executed.then(
            (value) => {
              resolve(value)
            },
            () => {},
          )
        })
        const executionErrored = new Promise((resolve) => {
          executed.catch((error) => {
            resolve(error)
          })
        })

        const { winner, value } = await promiseTrackRace([
          errored,
          disconnected,
          restarted,
          executionErrored,
          executionCompleted,
        ])

        if (winner === errored) {
          onError(value)
          return { status: "errored", value }
        }

        if (winner === executionErrored) {
          onError(value)
          return { status: "errored", value }
        }

        if (winner === disconnected) {
          disconnectCallback()
          return { status: "disconnected" }
        }

        if (winner === restarted) {
          return launchOperation.stop(value).then(startPlatform)
        }

        log(`${file} execution on ${platformTypeForLog} done with ${value}`)
        errored.then(onError)
        disconnected.then(disconnectCallback)

        if (stopOnceExecuted) {
          launchOperation.stop("stopOnceExecuted")
        }

        return { status: "completed", value }
      },
    })
    return executeOperation
  }

  return startPlatform()
}

// well this is unexpected but haven't decided yet how we will handle that
// const createDisconnectedDuringExecutionError = (file, platformType) => {
//   const error = new Error(`${platformType} disconnected while executing ${file}`)
//   error.code = "PLATFORM_DISCONNECTED_DURING_EXECUTION_ERROR"
//   return error
// }
