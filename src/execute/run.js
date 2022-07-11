import cuid from "cuid"
import { Abort, raceCallbacks } from "@jsenv/abort"
import { resolveUrl } from "@jsenv/urls"
import { writeFileSync } from "@jsenv/filesystem"

export const run = async ({
  signal = new AbortController().signal,
  logger,
  allocatedMs,
  keepRunning = false,
  mirrorConsole = false,
  collectConsole = false,
  coverageEnabled = false,
  coverageTempDirectoryUrl,
  collectPerformance = false,

  runtime,
  runtimeParams,
}) => {
  let result = {}
  const callbacks = []

  const onConsoleRef = { current: () => {} }
  const stopSignal = { notify: () => {} }
  const runtimeLabel = `${runtime.name}/${runtime.version}`

  const runOperation = Abort.startOperation()
  runOperation.addAbortSignal(signal)
  if (
    // ideally we would rather log than the timeout is ignored
    // when keepRunning is true
    !keepRunning &&
    typeof allocatedMs === "number" &&
    allocatedMs !== Infinity
  ) {
    const timeoutAbortSource = runOperation.timeout(allocatedMs)
    callbacks.push(() => {
      if (
        result.status === "errored" &&
        Abort.isAbortError(result.error) &&
        timeoutAbortSource.signal.aborted
      ) {
        result = {
          status: "timedout",
        }
      }
    })
  }
  callbacks.push(() => {
    if (result.status === "errored" && Abort.isAbortError(result.error)) {
      result = {
        status: "aborted",
      }
    }
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
    callbacks.push(() => {
      result.consoleCalls = consoleCalls
    })
  }

  const startMs = Date.now()
  callbacks.push(() => {
    result.duration = Date.now() - startMs
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
              const runResult = await runtime.run({
                signal: runOperation.signal,
                logger,
                ...runtimeParams,
                collectPerformance,
                keepRunning,
                stopSignal,
                onConsole: (log) => onConsoleRef.current(log),
              })
              cb(runResult)
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

    const { namespace, performance, coverage } = winner.data
    result.namespace = namespace
    if (collectPerformance) {
      result.performance = performance
    }
    if (coverageEnabled) {
      // we do not keep coverage in memory, it can grow very big
      // instead we store it on the filesystem
      // and they can be read later at "coverageFileUrl"
      const coverageFileUrl = resolveUrl(
        `./${runtime.name}/${cuid()}`,
        coverageTempDirectoryUrl,
      )
      writeFileSync(coverageFileUrl, JSON.stringify(coverage, null, "  "))
      result.coverageFileUrl = coverageFileUrl
    }
    callbacks.forEach((callback) => {
      callback()
    })
    return result
  } catch (e) {
    result = {
      status: "errored",
      error: e,
    }
    callbacks.forEach((callback) => {
      callback()
    })
    return result
  } finally {
    await runOperation.end()
  }
}
