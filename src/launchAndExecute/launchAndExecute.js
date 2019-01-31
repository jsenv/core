import {
  createCancellationToken,
  createOperation,
  createStoppableOperation,
} from "@dmail/cancellation"
import { promiseTrackRace } from "@dmail/helper"
import "../promise-finally.js"

// TODO: rename statusData into allocatedMs and error

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

  let capturedConsole = ""
  const getCapturedConsoleOrEmpty = () => {
    return captureConsole ? { capturedConsole } : {}
  }

  const startMs = Number(new Date())
  const createResult = ({ status }) => {
    const endMs = Number(new Date())
    return { status, ...getCapturedConsoleOrEmpty(), consumedMs: endMs - startMs }
  }

  const timeoutWhenExceedsAllocatedMs = async (promise) => {
    if (typeof allocatedMs !== "number") {
      const value = await promise
      return { timeout: false, value }
    }

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
      promise,
    })
    timeoutCancel()

    if (winner === timeoutPromise) {
      return { timeout: true }
    }
    return { timeout: false, value }
  }

  log(`launch ${platformTypeForLog} to execute ${file}`)
  const launchOperation = createStoppableOperation({
    cancellationToken,
    start: async () => {
      const value = await launchPlatform()
      startedCallback()
      return value
    },
    stop: ({ stop, stopForce }) => {
      // external code can cancel using canlleationToken
      // and listen for stoppedCallback before restarting the launchAndExecute operation.
      // it is important to keep that code here because once cancelled
      // all code after the operation won't execute because it will be rejected with
      // the cancellation error
      disconnected.then(stoppedCallback)

      log(`stop ${platformTypeForLog}`)
      stop()

      if (stopForce) {
        const id = setTimeout(stopForce, ALLOCATED_MS_BEFORE_FORCE_STOP)
        disconnected.finally(() => clearTimeout(id))
      }
      return disconnected
    },
  })

  const { timeout, value: launchValue } = await timeoutWhenExceedsAllocatedMs(launchOperation)
  if (timeout) {
    return createResult({ status: "timedout", statusData: allocatedMs })
  }

  const {
    options,
    disconnected,
    fileToExecuted,
    registerErrorCallback,
    registerConsoleCallback,
  } = launchValue

  log(`${platformTypeForLog} started ${JSON.stringify(options)}`)

  if (captureConsole) {
    registerConsoleCallback(({ text }) => {
      capturedConsole += text
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
  const executeOperation = createOperation({
    cancellationToken,
    start: async () => {
      const executed = fileToExecuted(file, executionOptions)
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

      const errored = new Promise((resolve) => {
        registerErrorCallback(resolve)
      })

      const executionPromise = promiseTrackRace([
        disconnected,
        errored,
        executionErrored,
        executionCompleted,
      ])

      const { timeout, value: raceValue } = timeoutWhenExceedsAllocatedMs(executionPromise)
      if (timeout) {
        return createResult({ status: "timedout", statusData: allocatedMs })
      }

      const { winner, value } = raceValue
      if (winner === disconnected) {
        return createResult({ status: "disconnected" })
      }

      if (winner === errored) {
        onError(value)
        return createResult({ status: "errored", statusData: value })
      }

      if (winner === executionErrored) {
        onError(value)
        return createResult({ status: "errored", statusData: value })
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

      const { status, ...rest } = value
      if (status === "resolved") {
        return createResult({ status: "completed", ...rest })
      }
      return createResult({ status: "errored", ...rest })
    },
  })

  return executeOperation
}

// well this is unexpected but haven't decided yet how we will handle that
// const createDisconnectedDuringExecutionError = (file, platformType) => {
//   const error = new Error(`${platformType} disconnected while executing ${file}`)
//   error.code = "PLATFORM_DISCONNECTED_DURING_EXECUTION_ERROR"
//   return error
// }
