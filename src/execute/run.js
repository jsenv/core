import cuid from "cuid"
import { Abort, raceCallbacks } from "@jsenv/abort"
import { resolveUrl } from "@jsenv/urls"
import { writeFile } from "@jsenv/filesystem"

export const run = async ({
  signal = new AbortController().signal,
  logger,
  allocatedMs,
  keepRunning = false,
  mirrorConsole = false,
  collectConsole = false,
  collectCoverage = false,
  coverageTempDirectoryUrl,
  collectPerformance = false,

  runtime,
  runtimeParams,
}) => {
  const onConsoleRef = { current: () => {} }
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
        return result
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
    const winnerPromise = new Promise((resolve) => {
      raceCallbacks(
        {
          aborted: (cb) => {
            runOperation.signal.addEventListener("abort", cb)
            return () => {
              runOperation.signal.removeEventListener("abort", cb)
            }
          },
          runned: async (cb) => {
            try {
              const result = await runtime.run({
                signal: runOperation.signal,
                logger,
                ...runtimeParams,
                collectPerformance,
                keepRunning,
                stopSignal,
                onConsole: (log) => onConsoleRef.current(log),
              })
              cb(result)
            } catch (e) {
              cb({
                status: "errored",
                error: e,
              })
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
    let result = winner.data
    result = await resultTransformer(result)
    return result
  } catch (e) {
    let result = {
      status: "errored",
      error: e,
    }
    result = await resultTransformer(result)
    return result
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
