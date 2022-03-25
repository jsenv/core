import cuid from "cuid"
import {
  createCallbackList,
  createCallbackListNotifiedOnce,
  Abort,
  raceCallbacks,
} from "@jsenv/abort"
import { resolveUrl, writeFile } from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/logger"

export const execute = async ({
  signal = new AbortController().signal,
  logLevel,
  allocatedMs,
  mirrorConsole = false,
  captureConsole = false, // rename collectConsole ?
  collectCoverage = false,
  coverageTempDirectoryUrl,
  // measurePerformance,
  // collectPerformance = false,

  runtime,
  runtimeParams,
}) => {
  const logger = createLogger({ logLevel })
  const errorCallbackList = createCallbackList()
  const outputCallbackList = createCallbackList()
  const stoppedCallbackList = createCallbackListNotifiedOnce()
  let resultTransformer = (result) => result
  const runtimeLabel = `${runtime.name}/${runtime.version}`

  errorCallbackList.add((error) => {
    logger.debug(
      createDetailedMessage(`error during execution`, {
        ["error stack"]: error.stack,
        ["runtime"]: runtimeLabel,
      }),
    )
  })

  const executeOperation = Abort.startOperation()
  executeOperation.addAbortSignal(signal)
  if (typeof allocatedMs === "number" && allocatedMs !== Infinity) {
    const timeoutAbortSource = executeOperation.timeout(allocatedMs)
    resultTransformer = composeTransformer(resultTransformer, (result) => {
      if (
        result.status === "errored" &&
        Abort.isAbortError(result.error) &&
        timeoutAbortSource.signal.aborted
      ) {
        return createTimedoutResult()
      }
      return result
    })
  }
  resultTransformer = composeTransformer(resultTransformer, (result) => {
    if (result.status === "errored" && Abort.isAbortError(result.error)) {
      return createAbortedResult()
    }
    return result
  })
  if (mirrorConsole) {
    outputCallbackList.add(({ type, text }) => {
      if (type === "error") {
        process.stderr.write(text)
      } else {
        process.stdout.write(text)
      }
    })
  }
  if (captureConsole) {
    const consoleCalls = []
    outputCallbackList.add(({ type, text }) => {
      consoleCalls.push({ type, text })
    })
    resultTransformer = composeTransformer(resultTransformer, (result) => {
      result.consoleCalls = consoleCalls
      return result
    })
  }
  if (collectCoverage) {
    resultTransformer = composeTransformer(
      resultTransformer,
      async (result) => {
        // we do not keep coverage in memory, it can grow very big
        // instead we store it on the filesystem
        // and they can be read later at "coverageFileUrl"
        const { coverage } = result
        if (coverage) {
          const coverageFileUrl = resolveUrl(
            `./${runtime.name}/${cuid()}`,
            coverageTempDirectoryUrl,
          )
          await writeFile(coverageFileUrl, JSON.stringify(coverage, null, "  "))
          result.coverageFileUrl = coverageFileUrl
          delete result.coverage
        }
      },
    )
  } else {
    resultTransformer = composeTransformer(resultTransformer, (result) => {
      // as collectCoverage is disabled
      // executionResult.coverage is undefined or {}
      // we delete it just to have a cleaner object
      delete result.coverage
      return result
    })
  }

  const startMs = Date.now()
  resultTransformer = composeTransformer(resultTransformer, (result) => {
    result.duration = Date.now() - startMs
    return result
  })

  try {
    const runtimeLabel = `${runtime.name}/${runtime.version}`
    logger.debug(`run() ${runtimeLabel}`)
    executeOperation.throwIfAborted()
    const winnerPromise = new Promise((resolve, reject) => {
      raceCallbacks(
        {
          aborted: (cb) => {
            executeOperation.signal.addEventListener("abort", cb)
            return () => {
              executeOperation.signal.removeEventListener("abort", cb)
            }
          },
          errored: (cb) => {
            return errorCallbackList.add(cb)
          },
          stopped: (cb) => {
            return stoppedCallbackList.add(cb)
          },
          runned: async (cb) => {
            try {
              const result = await runtime.run({
                signal,
                logger,
                ...runtimeParams,
                errorCallbackList,
                outputCallbackList,
                stoppedCallbackList,
              })
              cb(result)
            } catch (e) {
              reject(e)
            }
          },
        },
        resolve,
      )
    })
    const winner = await winnerPromise
    if (winner.name === "aborted") {
      executeOperation.throwIfAborted()
    }
    if (winner.name === "errored") {
      return await resultTransformer(
        createErroredExecutionResult({
          error: winner.data,
        }),
      )
    }
    if (winner.name === "stopped") {
      return await resultTransformer(
        createErroredExecutionResult({
          error: new Error(`runtime stopped during execution`),
        }),
      )
    }
    const result = winner.data
    return await resultTransformer(result)
  } catch (error) {
    return await resultTransformer(createErroredExecutionResult(error))
  } finally {
    await executeOperation.end()
  }
}

const composeTransformer = (previousTransformer, transformer) => {
  return async (value) => {
    const transformedValue = await previousTransformer(value)
    return transformer(transformedValue)
  }
}

const createAbortedResult = () => {
  return {
    status: "aborted",
  }
}
const createTimedoutResult = () => {
  return {
    status: "timedout",
  }
}
const createErroredExecutionResult = (error) => {
  return {
    status: "errored",
    error,
  }
}
