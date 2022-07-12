import cuid from "cuid"
import { Abort, raceCallbacks } from "@jsenv/abort"
import { ensureParentDirectories } from "@jsenv/filesystem"

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
  const result = {}
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
        result.status = "timedout"
        delete result.error
      }
    })
  }
  callbacks.push(() => {
    if (result.status === "errored" && Abort.isAbortError(result.error)) {
      result.status = "aborted"
      delete result.error
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

  // we do not keep coverage in memory, it can grow very big
  // instead we store it on the filesystem
  // and they can be read later at "coverageFileUrl"
  let coverageFileUrl
  if (coverageEnabled) {
    coverageFileUrl = new URL(
      `./${runtime.name}/${cuid()}.json`,
      coverageTempDirectoryUrl,
    ).href
    await ensureParentDirectories(coverageFileUrl)
    if (coverageEnabled) {
      result.coverageFileUrl = coverageFileUrl
      // written within the child_process/worker_thread or during runtime.run()
      // for browsers
      // (because it takes time to serialize and transfer the coverage object)
    }
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
                collectConsole,
                collectPerformance,
                coverageFileUrl,
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

    const { status, namespace, error, performance } = winner.data
    result.status = status
    if (status === "errored") {
      result.error = error
    } else {
      result.namespace = namespace
    }
    if (collectPerformance) {
      result.performance = performance
    }
    callbacks.forEach((callback) => {
      callback()
    })
    return result
  } catch (e) {
    result.status = "errored"
    result.error = e
    callbacks.forEach((callback) => {
      callback()
    })
    return result
  } finally {
    await runOperation.end()
  }
}
