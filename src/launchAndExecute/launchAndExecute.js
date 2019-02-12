import {
  createCancellationToken,
  createOperation,
  createStoppableOperation,
  createCancellationSource,
  cancellationTokenCompose,
  errorToCancelReason,
} from "@dmail/cancellation"
import { promiseTrackRace } from "@dmail/helper"

export const launchAndExecute = async ({
  cancellationToken = createCancellationToken(),
  launch,
  allocatedMs,
  captureConsole = false,
  mirrorConsole = false,
  measureDuration = false,
  // stopOnceExecuted false by default because you want to keep browser alive
  // or nodejs process
  // however unit test will pass true because they want to move on
  stopOnceExecuted = false,
  // stopOnError is false by default because it's better to keep process/browser alive
  // to debug the error to the its consequences
  // however unit test will pass true because they want to move on
  stopOnError = false,
  verbose = false,
  platformTypeForLog = "platform", // should be 'node', 'chromium', 'firefox'
  startedCallback = () => {},
  stoppedCallback = () => {},
  errorAfterExecutedCallback = () => {},
  disconnectAfterExecutedCallback = () => {},
  filenameRelative,
  collectNamespace = false,
  collectCoverage = false,
  instrument = collectCoverage,
} = {}) => {
  if (typeof launch !== "function")
    throw new TypeError(`launchAndExecute launch must be a function, got ${launch}`)
  if (typeof filenameRelative !== "string")
    throw new TypeError(
      `launchAndExecute filenameRelative must be a string, got ${filenameRelative}`,
    )

  let platformLog = ""
  const consoleCallback = ({ type, text }) => {
    if (captureConsole) {
      platformLog += text
    }
    if (mirrorConsole) {
      if (type === "error") {
        process.stderr.write(text)
      } else {
        process.stdout.write(text)
      }
    }
  }

  const startMs = Date.now()
  const executionResult = await computeRawExecutionResult({
    launch,
    cancellationToken,
    allocatedMs,
    consoleCallback,
    platformTypeForLog,
    verbose,
    stopOnceExecuted,
    stopOnError,
    errorAfterExecutedCallback,
    disconnectAfterExecutedCallback,
    startedCallback,
    stoppedCallback,
    filenameRelative,
    collectNamespace,
    collectCoverage,
    instrument,
  })
  const endMs = Date.now()
  if (measureDuration) {
    executionResult.startMs = startMs
    executionResult.endMs = endMs
  }
  if (captureConsole) {
    executionResult.platformLog = platformLog
  }
  return executionResult
}

const computeRawExecutionResult = async ({
  launch,
  cancellationToken,
  allocatedMs,
  consoleCallback,
  filenameRelative,
  ...rest
}) => {
  const hasAllocatedMs = typeof allocatedMs === "number"

  if (!hasAllocatedMs) {
    return computeExecutionResult({
      launch,
      cancellationToken,
      consoleCallback,
      filenameRelative,
      ...rest,
    })
  }

  const TIMEOUT_CANCEL_REASON = "timeout"
  const id = setTimeout(() => {
    timeoutCancellationSource.cancel(TIMEOUT_CANCEL_REASON)
  }, allocatedMs)
  const timeoutCancel = () => clearTimeout(id)
  cancellationToken.register(timeoutCancel)

  const timeoutCancellationSource = createCancellationSource()
  const externalOrTimeoutCancellationToken = cancellationTokenCompose(
    cancellationToken,
    timeoutCancellationSource.token,
  )

  try {
    const executionResult = await computeExecutionResult({
      launch,
      cancellationToken: externalOrTimeoutCancellationToken,
      consoleCallback,
      filenameRelative,
      ...rest,
    })
    timeoutCancel()
    return executionResult
  } catch (e) {
    if (errorToCancelReason(e) === TIMEOUT_CANCEL_REASON) {
      return createTimedoutExecutionResult()
    }
    throw e
  }
}

// when launchPlatform returns { disconnected, stop, stopForce }
// the launched platform have that amount of ms for disconnected to resolve
// before we call stopForce
const ALLOCATED_MS_BEFORE_FORCE_STOP = 8000

const computeExecutionResult = async ({
  launch,
  cancellationToken,
  verbose,
  platformTypeForLog,
  startedCallback,
  stoppedCallback,
  consoleCallback,
  errorAfterExecutedCallback,
  disconnectAfterExecutedCallback,
  stopOnError,
  stopOnceExecuted,
  filenameRelative,
  collectNamespace,
  collectCoverage,
  instrument,
}) => {
  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  log(`launch ${platformTypeForLog} to execute ${filenameRelative}`)
  const launchOperation = createStoppableOperation({
    cancellationToken,
    start: async () => {
      const value = await launch({ cancellationToken })
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

  registerConsoleCallback(consoleCallback)

  const onError = () => {
    if (stopOnError) {
      launchOperation.stop("stopOnError")
    }
  }

  log(`execute ${filenameRelative} on ${platformTypeForLog}`)
  const executionResult = await createOperation({
    cancellationToken,
    start: async () => {
      const disconnected = new Promise((resolve) => {
        registerDisconnectCallback(resolve)
      })

      const errored = new Promise((resolve) => {
        registerErrorCallback(resolve)
      })

      const executionPromise = executeFile(filenameRelative, {
        collectNamespace,
        collectCoverage,
        instrument,
      })
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
        return createDisconnectedExecutionResult({})
      }

      if (winner === errored) {
        onError(value)
        return createErroredExecutionResult({
          error: value,
        })
      }

      if (winner === executionErrored) {
        onError(value)
        return createErroredExecutionResult({
          error: value,
        })
      }

      log(`${filenameRelative} execution on ${platformTypeForLog} done with ${value}`)
      registerErrorCallback((error) => {
        log(`${platformTypeForLog} error ${error.stack}`)
        errorAfterExecutedCallback(error)
        onError(error)
      })
      registerDisconnectCallback(() => {
        log(`${platformTypeForLog} disconnected`)
        disconnectAfterExecutedCallback()
      })

      if (stopOnceExecuted) {
        launchOperation.stop("stopOnceExecuted")
      }

      const { status, coverageMap, error, namespace } = value
      if (status === "rejected") {
        return {
          ...createErroredExecutionResult({
            error,
          }),
          ...(collectCoverage ? { coverageMap } : {}),
        }
      }

      return {
        ...createCompletedExecutionResult(),
        ...(collectNamespace ? { namespace } : {}),
        ...(collectCoverage ? { coverageMap } : {}),
      }
    },
  })

  return executionResult
}

const createTimedoutExecutionResult = () => {
  return {
    status: "timedout",
  }
}

const createDisconnectedExecutionResult = () => {
  return {
    status: "disconnected",
  }
}

const createErroredExecutionResult = ({ error }) => {
  return {
    status: "errored",
    error,
  }
}

const createCompletedExecutionResult = () => {
  return {
    status: "completed",
  }
}

// well this is unexpected but haven't decided yet how we will handle that
// const createDisconnectedDuringExecutionError = (file, platformType) => {
//   const error = new Error(`${platformType} disconnected while executing ${file}`)
//   error.code = "PLATFORM_DISCONNECTED_DURING_EXECUTION_ERROR"
//   return error
// }
