import { createLogger, createDetailedMessage } from "@jsenv/logger"

import { Abortable } from "@jsenv/core/src/abort/main.js"
import { raceCallbacks } from "../../abort/callback_race.js"
import { composeIstanbulCoverages } from "./coverage/composeIstanbulCoverages.js"

const TIMING_BEFORE_EXECUTION = "before-execution"
const TIMING_DURING_EXECUTION = "during-execution"
const TIMING_AFTER_EXECUTION = "after-execution"

export const launchAndExecute = async ({
  signal = new AbortController().signal,
  launchAndExecuteLogLevel,

  runtime,
  runtimeParams,
  executeParams,

  allocatedMs,
  measureDuration = false,
  mirrorConsole = false,
  captureConsole = false, // rename collectConsole ?
  collectRuntimeName = false,
  collectRuntimeVersion = false,
  inheritCoverage = false,
  collectCoverage = false,
  measurePerformance,
  collectPerformance = false,

  // stopAfterExecute false by default because you want to keep browser alive
  // or nodejs process
  // however unit test will pass true because they want to move on
  stopAfterExecute = false,
  stopAfterExecuteReason = "stop after execute",
  // when launch returns { stoppedSignal, gracefulStop, stop }
  // the launched runtime have that amount of ms for disconnected to resolve
  // before we call stop
  gracefulStopAllocatedMs = 4000,

  runtimeConsoleCallback = () => {},
  runtimeStartedCallback = () => {},
  runtimeStoppedCallback = () => {},
  runtimeErrorAfterExecutionCallback = (error) => {
    // by default throw on error after execution
    throw error
  },

  coverageV8MergeConflictIsExpected,
} = {}) => {
  const logger = createLogger({ logLevel: launchAndExecuteLogLevel })

  if (typeof runtime !== "object") {
    throw new TypeError(`runtime must be an object, got ${runtime}`)
  }
  if (typeof runtime.launch !== "function") {
    throw new TypeError(
      `runtime.launch must be a function, got ${runtime.launch}`,
    )
  }

  let executionResultTransformer = (executionResult) => executionResult

  const launchAndExecuteOperation = Abortable.fromSignal(signal)

  const hasAllocatedMs =
    typeof allocatedMs === "number" && allocatedMs !== Infinity
  let timeoutAbortEffect

  if (hasAllocatedMs) {
    timeoutAbortEffect = Abortable.timeout(
      launchAndExecuteOperation,
      // FIXME: if allocatedMs is veryyyyyy big
      // setTimeout may be called immediatly
      // in that case we should just throw that the number is too big
      allocatedMs,
    )
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      (executionResult) => {
        timeoutAbortEffect.cleanup()
        return executionResult
      },
    )
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

  if (mirrorConsole) {
    runtimeConsoleCallback = composeCallback(
      runtimeConsoleCallback,
      ({ type, text }) => {
        if (type === "error") {
          process.stderr.write(text)
        } else {
          process.stdout.write(text)
        }
      },
    )
  }

  if (captureConsole) {
    const consoleCalls = []
    runtimeConsoleCallback = composeCallback(
      runtimeConsoleCallback,
      ({ type, text }) => {
        consoleCalls.push({ type, text })
      },
    )
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      (executionResult) => {
        executionResult.consoleCalls = consoleCalls
        return executionResult
      },
    )
  }

  if (collectRuntimeName) {
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      (executionResult) => {
        executionResult.runtimeName = runtime.name
        return executionResult
      },
    )
  }

  if (collectRuntimeVersion) {
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      (executionResult) => {
        executionResult.runtimeVersion = runtime.version
        return executionResult
      },
    )
  }

  if (
    inheritCoverage &&
    // NODE_V8_COVERAGE is doing the coverage propagation for us
    !process.env.NODE_V8_COVERAGE
  ) {
    const collectCoverageSaved = collectCoverage
    collectCoverage = true
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      (executionResult) => {
        const { coverage, ...rest } = executionResult
        // ensure the coverage of the executed file is taken into account
        global.__coverage__ = composeIstanbulCoverages([
          global.__coverage__ || {},
          coverage || {},
        ])
        if (collectCoverageSaved) {
          return executionResult
        }
        return rest
      },
    )
  }

  // indirectCoverage is a feature making possible to collect
  // coverage generated by executing a node process which executes
  // a browser. The coverage coming the browser executionwould be lost
  // if not propagated somehow.
  // This is possible if the node process collect the browser coverage
  // and write it into global.__indirectCoverage__
  // This is used by jsenv during tests execution
  if (collectCoverage) {
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      (executionResult) => {
        const { coverage = {}, indirectCoverage } = executionResult
        if (indirectCoverage) {
          executionResult.coverage = composeIstanbulCoverages(
            [coverage, indirectCoverage],
            {
              coverageV8MergeConflictIsExpected,
            },
          )
        }
        return executionResult
      },
    )
  } else {
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      (executionResult) => {
        // as collectCoverage is disabled
        // executionResult.coverage is undefined or {}
        // we delete it just to have a cleaner object
        delete executionResult.coverage
        return executionResult
      },
    )
  }

  if (stopAfterExecute) {
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      async (executionResult) => {
        // if there is an error while cleaning (stopping the runtime)
        // the execution is considered as failed
        try {
          await launchAndExecuteOperation.cleaner.clean(stopAfterExecuteReason)
          return executionResult
        } catch (e) {
          return executionResultTransformer(
            createErroredExecutionResult({
              error: e,
            }),
          )
        }
      },
    )
  }

  try {
    const runtimeLabel = `${runtime.name}/${runtime.version}`
    logger.debug(`launch ${runtimeLabel} to execute something in it`)

    Abortable.throwIfAborted(launchAndExecuteOperation)
    const launchReturnValue = await runtime.launch({
      signal: launchAndExecuteOperation.signal,
      logger,
      stopAfterExecute,
      measurePerformance,
      collectPerformance,
      ...runtimeParams,
    })
    validateLaunchReturnValue(launchReturnValue)
    launchAndExecuteOperation.cleaner.addCallback(async (reason) => {
      await stopRuntime({
        logger,
        runtimeLabel,
        launchReturnValue,
        gracefulStopAllocatedMs,
        reason,
      })
    })

    logger.debug(createDetailedMessage(`${runtimeLabel}: runtime launched`))
    runtimeStartedCallback()

    logger.debug(`${runtimeLabel}: start execution`)
    const {
      errorSignal,
      outputSignal,
      stoppedSignal,
      execute,
      finalizeExecutionResult = (executionResult) => executionResult,
    } = launchReturnValue
    executionResultTransformer = composeTransformer(
      executionResultTransformer,
      finalizeExecutionResult,
    )
    outputSignal.addCallback(runtimeConsoleCallback)

    let timing = TIMING_BEFORE_EXECUTION
    stoppedSignal.addCallback(() => {
      logger.debug(`${runtimeLabel}: runtime stopped ${timing}`)
      runtimeStoppedCallback()
    })

    const winnerPromise = new Promise((resolve, reject) => {
      raceCallbacks(
        {
          aborted: (cb) => {
            launchAndExecuteOperation.signal.addEventListener("abort", cb)
            return () => {
              launchAndExecuteOperation.signal.removeEventListener("abort", cb)
            }
          },
          error: (cb) => {
            return errorSignal.addCallback(cb)
          },
          stopped: (cb) => {
            return stoppedSignal.addCallback(cb)
          },
          executed: (cb) => {
            timing = TIMING_DURING_EXECUTION
            const executed = execute({
              signal: launchAndExecuteOperation.signal,
              ...executeParams,
            })
            executed.then(cb, reject)
          },
        },
        resolve,
      )
    })

    Abortable.throwIfAborted(launchAndExecuteOperation)

    const winner = await winnerPromise

    if (winner.name === "aborted") {
      Abortable.throwIfAborted(launchAndExecuteOperation)
    }

    if (winner.name === "error") {
      return executionResultTransformer(
        createErroredExecutionResult({
          error: winner.data,
        }),
      )
    }

    if (winner.name === "stopped") {
      return executionResultTransformer(
        createErroredExecutionResult({
          error: new Error(`runtime stopped during execution`),
        }),
      )
    }

    timing = TIMING_AFTER_EXECUTION

    if (!stopAfterExecute) {
      // when the process is still alive
      // we want to catch error to notify runtimeErrorAfterExecutionCallback
      // and throw that error by default
      errorSignal.addCallback((error) => {
        runtimeErrorAfterExecutionCallback(error)
      })
    }

    const executeResult = winner.data
    const { status } = executeResult

    if (status === "errored") {
      // debug log level because this error happens during execution
      // there is no need to log it.
      // the code will know the execution errored because it receives
      // an errored execution result
      logger.debug(
        createDetailedMessage(`error ${TIMING_DURING_EXECUTION}`, {
          ["error stack"]: executeResult.error.stack,
          ["execute params"]: JSON.stringify(executeParams, null, "  "),
          ["runtime"]: runtime,
        }),
      )
      return executionResultTransformer(
        createErroredExecutionResult(executeResult),
      )
    }

    logger.debug(`${runtimeLabel}: execution completed`)
    return executionResultTransformer(
      createCompletedExecutionResult(executeResult),
    )
  } catch (e) {
    if (e.name === "AbortError") {
      if (timeoutAbortEffect && timeoutAbortEffect.signal.aborted) {
        const executionResult = createTimedoutExecutionResult()
        return executionResultTransformer(executionResult)
      }
      const executionResult = createAbortedExecutionResult()
      return executionResultTransformer(executionResult)
    }
    throw e
  }
}

const stopRuntime = async ({
  logger,
  runtimeLabel,
  launchReturnValue,
  gracefulStopAllocatedMs,
  reason,
}) => {
  const { stop } = launchReturnValue
  logger.debug(`${runtimeLabel}: stop() because ${reason}`)
  const { graceful } = await stop({ reason, gracefulStopAllocatedMs })
  if (graceful) {
    logger.debug(`${runtimeLabel}: runtime stopped gracefully`)
  } else {
    logger.debug(`${runtimeLabel}: runtime stopped`)
  }
}

const createAbortedExecutionResult = () => {
  return {
    status: "aborted",
  }
}

const createTimedoutExecutionResult = () => {
  return {
    status: "timedout",
  }
}

const createErroredExecutionResult = (executionResult) => {
  return {
    ...executionResult,
    status: "errored",
  }
}

const createCompletedExecutionResult = (executionResult) => {
  return {
    ...executionResult,
    status: "completed",
    namespace: normalizeNamespace(executionResult.namespace),
  }
}

const normalizeNamespace = (namespace) => {
  if (typeof namespace !== "object") return namespace
  if (namespace instanceof Promise) return namespace
  const normalized = {}
  // remove "__esModule" or Symbol.toStringTag from namespace object
  Object.keys(namespace).forEach((key) => {
    normalized[key] = namespace[key]
  })
  return normalized
}

const composeCallback = (previousCallback, callback) => {
  return (...args) => {
    previousCallback(...args)
    return callback(...args)
  }
}

const composeTransformer = (previousTransformer, transformer) => {
  return async (value) => {
    const transformedValue = await previousTransformer(value)
    return transformer(transformedValue)
  }
}

const validateLaunchReturnValue = (launchReturnValue) => {
  if (launchReturnValue === null) {
    throw new Error(`launch must return an object, got null`)
  }

  if (typeof launchReturnValue !== "object") {
    throw new Error(`launch must return an object, got ${launchReturnValue}`)
  }

  const { execute } = launchReturnValue
  if (typeof execute !== "function") {
    throw new Error(`launch must return an execute function, got ${execute}`)
  }

  const { stoppedSignal } = launchReturnValue
  if (!stoppedSignal) {
    throw new Error(
      `launch must return a stoppedSignal object, got ${stoppedSignal}`,
    )
  }
}
