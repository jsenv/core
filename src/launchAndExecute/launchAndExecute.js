import {
  createCancellationToken,
  createOperation,
  createStoppableOperation,
  createCancellationSource,
  cancellationTokenCompose,
  errorToCancelReason,
} from "@dmail/cancellation"
import { promiseTrackRace } from "@dmail/helper"
import { createLogger, LOG_LEVEL_OFF } from "../logger.js"
import { coverageMapCompose } from "../coverage/executionPlanResultToCoverageMap/coverageMapCompose.js"

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
  logLevel = LOG_LEVEL_OFF,
  consoleCallback = () => {},
  startedCallback = () => {},
  stoppedCallback = () => {},
  errorAfterExecutedCallback = () => {},
  disconnectAfterExecutedCallback = () => {},
  fileRelativePath,
  collectNamespace = false,
  collectCoverage = false,
  inheritCoverage = false,
  collectPlatformNameAndVersion = false,
} = {}) => {
  if (typeof launch !== "function")
    throw new TypeError(`launchAndExecute launch must be a function, got ${launch}`)
  if (typeof fileRelativePath !== "string")
    throw new TypeError(
      `launchAndExecute fileRelativePath must be a string, got ${fileRelativePath}`,
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

  if (inheritCoverage) {
    const savedCollectCoverage = collectCoverage
    collectCoverage = true
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      (executionResult) => {
        const { coverageMap, ...rest } = executionResult
        // ensure the coverage of the launched stuff
        // is accounted as coverage for this
        global.__coverage__ = coverageMapCompose(global.__coverage__ || {}, coverageMap)
        return savedCollectCoverage ? executionResult : rest
      },
    )
  }

  const executionResult = await computeRawExecutionResult({
    launch,
    cancellationToken,
    allocatedMs,
    logLevel,
    consoleCallback,
    stopOnceExecuted,
    stopOnError,
    errorAfterExecutedCallback,
    disconnectAfterExecutedCallback,
    startedCallback,
    stoppedCallback,
    fileRelativePath,
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
  fileRelativePath,
  ...rest
}) => {
  const hasAllocatedMs = typeof allocatedMs === "number"

  if (!hasAllocatedMs) {
    return computeExecutionResult({
      launch,
      cancellationToken,
      consoleCallback,
      fileRelativePath,
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
      fileRelativePath,
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
  logLevel,
  startedCallback,
  stoppedCallback,
  consoleCallback,
  errorAfterExecutedCallback,
  disconnectAfterExecutedCallback,
  stopOnError,
  stopOnceExecuted,
  fileRelativePath,
  collectNamespace,
  collectCoverage,
}) => {
  const { log, logError } = createLogger({ logLevel })
  log(createStartingPlatformMessage({ fileRelativePath }))

  const launchOperation = createStoppableOperation({
    cancellationToken,
    start: async () => {
      const value = await launch({ cancellationToken, logLevel })
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

  log(createStartExecutionMessage({ fileRelativePath }))

  const executionResult = await createOperation({
    cancellationToken,
    start: async () => {
      const disconnected = new Promise((resolve) => {
        registerDisconnectCallback(resolve)
      })

      const errored = new Promise((resolve) => {
        registerErrorCallback(resolve)
      })

      const executionPromise = executeFile(fileRelativePath, {
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
        logError(createExecutionErrorMessage({ error: value }))
        onError(value)
        return createErroredExecutionResult({
          error: value,
        })
      }

      log(createExecutionDoneMessage({ value }))

      registerErrorCallback((error) => {
        logError(createAfterExecutionErrorMessage({ error }))
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

const createStartingPlatformMessage = () => `
start a platform to execute a file.`

const createPlatformStartedMessage = ({
  platformName,
  platformVersion,
  options,
}) => `platform started.
platformName: ${platformName}
platformVersion: ${platformVersion}
options: ${JSON.stringify(options)}`

const createPlatformStoppedMessage = () => `platform stopped.`

const createStartExecutionMessage = ({ fileRelativePath }) => `execute file.
fileRelativePath: ${fileRelativePath}`

const createExecutionErrorMessage = ({ error }) => `error during execution.
stack: ${error.stack}`

const createAfterExecutionErrorMessage = ({ error }) => `error after execution.
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
