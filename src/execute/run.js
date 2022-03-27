import cuid from "cuid"
import { Abort, raceCallbacks } from "@jsenv/abort"
import { resolveUrl, writeFile } from "@jsenv/filesystem"
import { createLogger, createDetailedMessage } from "@jsenv/logger"

export const run = async ({
  signal = new AbortController().signal,
  logLevel,
  allocatedMs,
  keepRunning = false,
  mirrorConsole = false,
  collectConsole = false,
  collectCoverage = false,
  coverageTempDirectoryUrl,

  // measurePerformance,
  // collectPerformance = false,

  runtime,
  runtimeParams,
}) => {
  const logger = createLogger({ logLevel })
  const onErrorRef = { current: () => {} }
  const onConsoleRef = { current: () => {} }
  const onStopRef = { current: () => {} }
  const stopSignal = { notify: () => {} }

  let resultTransformer = (result) => result
  const runtimeLabel = `${runtime.name}/${runtime.version}`

  const runOperation = Abort.startOperation()
  runOperation.addAbortSignal(signal)
  if (typeof allocatedMs === "number" && allocatedMs !== Infinity) {
    const timeoutAbortSource = runOperation.timeout(allocatedMs)
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
  const consoleCalls = []
  onConsoleRef.current = ({ type, text }) => {
    if (mirrorConsole) {
      if (type === "error") {
        process.stderr.write(text)
      } else {
        process.stdout.write(text)
      }
    }
    if (collectConsole) {
      consoleCalls.push({ type, text })
    }
  }
  if (collectConsole) {
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
    logger.debug(`run() ${runtimeLabel}`)
    runOperation.throwIfAborted()
    const winnerPromise = new Promise((resolve, reject) => {
      raceCallbacks(
        {
          aborted: (cb) => {
            runOperation.signal.addEventListener("abort", cb)
            return () => {
              runOperation.signal.removeEventListener("abort", cb)
            }
          },
          errored: (cb) => {
            onErrorRef.current = (error) => {
              logger.debug(
                createDetailedMessage(`error during execution`, {
                  ["error stack"]: error.stack,
                  ["runtime"]: runtimeLabel,
                }),
              )
              cb(error)
            }
          },
          stopped: (cb) => {
            onStopRef.current = cb
          },
          runned: async (cb) => {
            try {
              await runtime.run({
                signal,
                logger,
                ...runtimeParams,
                keepRunning,
                stopSignal,
                onStop: (stopInfo) => onStopRef.current(stopInfo),
                onError: (error) => onErrorRef.current(error),
                onConsole: (log) => onConsoleRef.current(log),
                onResult: cb,
              })
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
      runOperation.throwIfAborted()
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
    onErrorRef.current = (error) => {
      throw error
    }
    const result = winner.data
    return await resultTransformer(result)
  } catch (error) {
    return await resultTransformer(
      createErroredExecutionResult({
        error,
      }),
    )
  } finally {
    await runOperation.end()
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
const createErroredExecutionResult = ({ error }) => {
  return {
    status: "errored",
    error,
  }
}
