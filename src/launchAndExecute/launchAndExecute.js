import {
  createCancellationToken,
  createOperation,
  createStoppableOperation,
} from "@dmail/cancellation"
import { promiseTrackRace } from "@dmail/helper"
import "../promise-finally.js"

// when launchPlatform returns { disconnected, stop, stopForce }
// the launched platform have that amount of ms for disconnected to resolve
// before we call stopForce
const ALLOCATED_MS_BEFORE_FORCE_STOP = 10 * 60 * 10 * 1000

export const launchAndExecute = async (
  launchPlatform,
  file,
  {
    cancellationToken = createCancellationToken(),
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
    errorAfterExecutedCallback = (error) => {
      console.log(`${platformTypeForLog} error ${error.stack}`)
    },
    disconnectAfterExecutedCallback = () => {
      console.log(`${platformTypeForLog} disconnected`)
    },
    startedCallback = () => {},
    stoppedCallback = () => {},
    mirrorConsole = false,
    captureConsole = false,
    allocatedMs,
    ...executionOptions
  } = {},
) => {
  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  let platformLog = ""

  const startMs = Date.now()

  const computeResult = async () => {
    log(`launch ${platformTypeForLog} to execute ${file}`)
    const launchOperation = createStoppableOperation({
      cancellationToken,
      start: async () => {
        const value = await launchPlatform()
        startedCallback()
        return value
      },
      stop: ({ stop, stopForce, registerDisconnectCallback }) => {
        // external code can cancel using canlleationToken
        // and listen for stoppedCallback before restarting the launchAndExecute operation.
        // it is important to keep that code here because once cancelled
        // all code after the operation won't execute because it will be rejected with
        // the cancellation error
        registerDisconnectCallback(stoppedCallback)

        log(`stop ${platformTypeForLog}`)
        stop()

        if (stopForce) {
          const id = setTimeout(stopForce, ALLOCATED_MS_BEFORE_FORCE_STOP)
          registerDisconnectCallback(() => {
            clearTimeout(id)
          })
        }

        return new Promise((resolve) => {
          registerDisconnectCallback(resolve)
        })
      },
    })

    const {
      options,
      executeFile,
      registerErrorCallback,
      registerConsoleCallback,
      registerDisconnectCallback,
    } = await launchOperation

    log(`${platformTypeForLog} started ${JSON.stringify(options)}`)

    if (captureConsole) {
      registerConsoleCallback(({ text }) => {
        platformLog += text
      })
    }
    if (mirrorConsole) {
      registerConsoleCallback(({ type, text }) => {
        if (type === "error") {
          process.stderr.write(text)
          return
        }
        process.stdout.write(text)
      })
    }

    const onError = () => {
      if (stopOnError) {
        launchOperation.stop("stopOnError")
      }
    }

    log(`execute ${file} on ${platformTypeForLog}`)
    const executionResult = await createOperation({
      cancellationToken,
      start: async () => {
        const disconnected = new Promise((resolve) => {
          registerDisconnectCallback(resolve)
        })

        const errored = new Promise((resolve) => {
          registerErrorCallback(resolve)
        })

        const executionPromise = executeFile(file, executionOptions)
        const executionCompleted = new Promise((resolve) => {
          executionPromise.then(
            (value) => {
              resolve(value)
            },
            () => {},
          )
        })

        const executionErrored = new Promise((resolve) => {
          executionPromise.catch((error) => {
            resolve(error)
          })
        })

        const { winner, value } = await promiseTrackRace([
          disconnected,
          errored,
          executionErrored,
          executionCompleted,
        ])

        if (winner === disconnected) {
          return createDisconnectedExecutionResult({
            startMs,
            endMs: Date.now(),
            platformLog,
          })
        }

        if (winner === errored) {
          onError(value)
          return createErroredExecutionResult({
            startMs,
            endMs: Date.now(),
            error: value,
            platformLog,
          })
        }

        if (winner === executionErrored) {
          onError(value)
          return createErroredExecutionResult({
            startMs,
            endMs: Date.now(),
            error: value,
            platformLog,
          })
        }

        log(`${file} execution on ${platformTypeForLog} done with ${value}`)
        registerErrorCallback((error) => {
          errorAfterExecutedCallback(error)
          onError(error)
        })
        disconnected.then(() => {
          disconnectAfterExecutedCallback()
        })

        if (stopOnceExecuted) {
          launchOperation.stop("stopOnceExecuted")
        }

        const { status, coverageMap, error, namespace } = value
        if (status === "rejected") {
          return createErroredExecutionResult({
            startMs,
            endMs: Date.now(),
            error,
            platformLog,
            coverageMap,
          })
        }

        return createCompletedExecutionResult({
          startMs,
          endMs: Date.now(),
          platformLog,
          coverageMap,
          namespace,
        })
      },
    })

    return executionResult
  }

  const resultPromise = computeResult()

  if (typeof allocatedMs !== "number") return resultPromise

  let timeoutCancel = () => {}
  const timeoutPromise = new Promise((resolve) => {
    const consumedMs = Date.now() - startMs
    const remainingMs = allocatedMs - consumedMs
    const id = setTimeout(resolve, remainingMs)
    timeoutCancel = () => clearTimeout(id)
    cancellationToken.register(timeoutCancel)
  })

  const { winner, value } = await promiseTrackRace({
    timeoutPromise,
    resultPromise,
  })

  if (winner === timeoutPromise)
    return createTimedoutExecutionResult({
      allocatedMs,
      platformLog,
    })

  timeoutCancel()
  return value
}

const createTimedoutExecutionResult = ({ startMs, endMs, platformLog }) => {
  return {
    status: "timedout",
    startMs,
    endMs,
    platformLog,
  }
}

const createDisconnectedExecutionResult = ({ startMs, endMs, platformLog }) => {
  return {
    status: "disconnected",
    startMs,
    endMs,
    platformLog,
  }
}

const createErroredExecutionResult = ({ startMs, endMs, platformLog, coverageMap, error }) => {
  return {
    status: "errored",
    startMs,
    endMs,
    platformLog,
    coverageMap,
    error,
  }
}

const createCompletedExecutionResult = ({
  startMs,
  endMs,
  platformLog,
  coverageMap,
  namespace,
}) => {
  return {
    status: "completed",
    startMs,
    endMs,
    platformLog,
    coverageMap,
    namespace,
  }
}

// well this is unexpected but haven't decided yet how we will handle that
// const createDisconnectedDuringExecutionError = (file, platformType) => {
//   const error = new Error(`${platformType} disconnected while executing ${file}`)
//   error.code = "PLATFORM_DISCONNECTED_DURING_EXECUTION_ERROR"
//   return error
// }
