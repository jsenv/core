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
  const result = {
    status: "pending",
    errors: [],
    namespace: null,
  }
  const callbacks = []

  const onConsoleRef = { current: () => {} }
  const stopSignal = { notify: () => {} }
  const runtimeLabel = `${runtime.name}/${runtime.version}`

  const runOperation = Abort.startOperation()
  runOperation.addAbortSignal(signal)
  let timeoutAbortSource
  if (
    // ideally we would rather log than the timeout is ignored
    // when keepRunning is true
    !keepRunning &&
    typeof allocatedMs === "number" &&
    allocatedMs !== Infinity
  ) {
    timeoutAbortSource = runOperation.timeout(allocatedMs)
  }
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
    result.consoleCalls = consoleCalls
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
                errors: [e],
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
    const { status, namespace, errors, performance } = winner.data
    result.status = status
    result.errors.push(...errors)
    result.namespace = namespace
    if (collectPerformance) {
      result.performance = performance
    }
  } catch (e) {
    if (Abort.isAbortError(e)) {
      if (timeoutAbortSource && timeoutAbortSource.signal.aborted) {
        result.status = "timedout"
      } else {
        result.status = "aborted"
      }
    } else {
      result.status = "errored"
      result.errors.push(e)
    }
  } finally {
    await runOperation.end()
  }

  callbacks.forEach((callback) => {
    callback()
  })
  return result
}
