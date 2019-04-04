import {
  createCancellationToken,
  createOperation,
  createStoppableOperation,
  createCancellationSource,
  cancellationTokenCompose,
  errorToCancelReason,
} from "/node_modules/@dmail/cancellation/index.js"
import { promiseTrackRace } from "/node_modules/@dmail/helper/index.js"

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
  consoleCallback = () => {},
  startedCallback = () => {},
  stoppedCallback = () => {},
  errorAfterExecutedCallback = () => {},
  disconnectAfterExecutedCallback = () => {},
  filenameRelative,
  collectNamespace = false,
  collectCoverage = false,
  collectPlatformNameAndVersion = false,
} = {}) => {
  if (typeof launch !== "function")
    throw new TypeError(`launchAndExecute launch must be a function, got ${launch}`)
  if (typeof filenameRelative !== "string")
    throw new TypeError(
      `launchAndExecute filenameRelative must be a string, got ${filenameRelative}`,
    )

  let executionResultTransformer = (executionResult) => executionResult

  if (captureConsole) {
    let platformLog = ""
    consoleCallback = composeCallback(consoleCallback, ({ text }) => {
      platformLog += text
    })
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      (executionResult) => {
        executionResult.platformLog = platformLog
        return executionResult
      },
    )
  }

  if (mirrorConsole) {
    consoleCallback = composeCallback(consoleCallback, ({ type, text }) => {
      if (type === "error") {
        process.stderr.write(text)
      } else {
        process.stdout.write(text)
      }
    })
  }

  if (collectPlatformNameAndVersion) {
    startedCallback = composeCallback(startedCallback, ({ name, version }) => {
      executionResultTransformer = composeTransformer(
        executionResultTransformer,
        (executionResult) => {
          executionResult.platformName = name
          executionResult.platformVersion = version
          return executionResult
        },
      )
    })
  }

  if (measureDuration) {
    const startMs = Date.now()
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      (executionResult) => {
        const endMs = Date.now()
        executionResult.startMs = startMs
        executionResult.endMs = endMs
        return executionResult
      },
    )
  }

  const executionResult = await computeRawExecutionResult({
    launch,
    cancellationToken,
    allocatedMs,
    consoleCallback,
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
  })

  return executionResultTransformer(executionResult)
}

const composeCallback = (previousCallback, callback) => {
  return (...args) => {
    previousCallback(...args)
    return callback(...args)
  }
}

const composeTransformer = (previousTransformer, transformer) => {
  return (value) => {
    const transformedValue = previousTransformer(value)
    return transformer(transformedValue)
  }
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
}) => {
  const log = verbose ? (...args) => console.log(...args) : () => {}

  log(createStartingPlatformMessage({ filenameRelative }))

  const launchOperation = createStoppableOperation({
    cancellationToken,
    start: async () => {
      const value = await launch({ cancellationToken })
      startedCallback({ name: value.name, version: value.version })
      return value
    },
    stop: async ({ stop, stopForce }) => {
      // external code can cancel using canllelationToken
      // and listen for stoppedCallback before restarting the launchAndExecute operation.
      // it is important to keep the code inside this stop function because once cancelled
      // all code after the operation won't execute because it will be rejected with
      // the cancellation error

      let forceStopped = false

      if (stopForce) {
        const stopPromise = (async () => {
          await stop()
          return false
        })()

        const stopForcePromise = (async () => {
          await new Promise(async (resolve) => {
            const timeoutId = setTimeout(resolve, ALLOCATED_MS_BEFORE_FORCE_STOP)
            try {
              await stopPromise
            } finally {
              clearTimeout(timeoutId)
            }
          })
          await stopForce()
          return true
        })()

        forceStopped = await Promise.all([stopPromise, stopForcePromise])
      } else {
        await stop()
      }

      stoppedCallback({ forced: forceStopped })
      log(createPlatformStoppedMessage())
    },
  })

  const {
    name: platformName,
    version: platformVersion,
    options,
    executeFile,
    registerErrorCallback,
    registerConsoleCallback,
    registerDisconnectCallback,
  } = await launchOperation

  log(createPlatformStartedMessage({ platformName, platformVersion, options }))

  registerConsoleCallback(consoleCallback)

  const onError = () => {
    if (stopOnError) {
      launchOperation.stop("stopOnError")
    }
  }

  log(createStartExecutionMessage({ filenameRelative }))

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

      log(createExecutionDoneMessage({ value }))

      registerErrorCallback((error) => {
        log(createExecutionErrorMessage({ error }))
        errorAfterExecutedCallback(error)
        onError(error)
      })
      registerDisconnectCallback(() => {
        log(createDisconnectedMessage())
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

const createStartingPlatformMessage = ({ filenameRelative }) => `start a platform to execute a file.
filenameRelative: ${filenameRelative}`

const createPlatformStartedMessage = ({
  platformName,
  platformVersion,
  options,
}) => `platform started.
platformName: ${platformName}
platformVersion: ${platformVersion}
options: ${JSON.stringify(options)}`

const createPlatformStoppedMessage = () => `platform stopped.`

const createStartExecutionMessage = ({ filenameRelative }) => `execute file.
filenameRelative: ${filenameRelative}`

const createExecutionErrorMessage = ({ error }) => `error during execution.
stack: ${error.stack}`

const createExecutionDoneMessage = ({ value }) => `execution done.
value: ${value}`

const createDisconnectedMessage = () => `platform disconnected.`

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
