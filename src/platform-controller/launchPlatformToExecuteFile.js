import {
  createCancellationToken,
  cancellationTokenCompose,
  cancellationTokenToPromise,
  createOperation,
} from "@dmail/cancellation"
import { promiseTrackRace } from "../promiseHelper.js"
// import { hotreloadOpen } from "./hotreload.js"
import { createRestartSignal } from "./restartController.js"

// when launchPlatform returns close/closeForce
// the launched platform have that amount of ms to close
// before we call closeForce
const ALLOCATED_MS_FOR_CLOSE = 10 * 60 * 10 * 1000

export const launchPlatformToExecuteFile = (
  launchPlatform,
  {
    cancellationToken = createCancellationToken(),
    platformTypeForLog = "platform", // should be 'node', 'chromium', 'firefox'
    // hotreload = false,
    // hotreloadSSERoot,
    verbose = false,
  } = {},
) => {
  const log = (...args) => {
    if (verbose) {
      console.log(...args)
    }
  }

  // remove hotreloading for now
  // it can be externalized anyway
  // if (hotreload) {
  //   const hotreloadRestartSource = createRestartSource()
  //   cancellationToken.register(
  //     hotreloadOpen(hotreloadSSERoot, (fileChanged) => {
  //       hotreloadRestartSource.restart(`file changed: ${fileChanged}`)
  //     }),
  //   )
  // }

  const platformCancellationToken = cancellationToken

  const executeFile = (
    file,
    {
      cancellationToken = createCancellationToken(),
      restartSignal = createRestartSignal(),
      instrument = false,
      setup = () => {},
      teardown = () => {},
    } = {},
  ) => {
    const executionCancellationToken = cancellationTokenCompose(
      platformCancellationToken,
      cancellationToken,
    )

    const startPlatform = async () => {
      executionCancellationToken.throwIfRequested()

      log(`launch ${platformTypeForLog} to execute ${file}`)
      const { opened, errored, closed, close, closeForce, fileToExecuted } = await launchPlatform()

      const platformOperation = createOperation({
        cancellationToken: executionCancellationToken,
        promise: opened,
        stop: (reason) => {
          log(`stop ${platformTypeForLog}`)
          close(reason)

          const stopped = Promise.race([errored, closed])
          if (closeForce) {
            const id = setTimeout(closeForce, ALLOCATED_MS_FOR_CLOSE)
            stopped.finally(() => clearTimeout(id))
          }
          return stopped
        },
      })

      await platformOperation

      log(`execute ${file} on ${platformTypeForLog}`)

      const executed = fileToExecuted(file, { instrument, setup, teardown })
      const canceled = cancellationTokenToPromise(executionCancellationToken)
      const restarted = new Promise((resolve) => {
        restartSignal.onrestart = resolve
      })

      const { winner, value } = await promiseTrackRace([
        // canceled will reject in case of cancellation
        canceled,
        restarted,
        errored,
        closed,
        executed,
      ])

      if (winner === restarted) {
        return platformOperation.stop(value).then(startPlatform)
      }
      if (winner === errored) {
        log(`${platformTypeForLog} error: ${value}`)
        return Promise.reject(value)
      }
      if (winner === closed) {
        log(`${platformTypeForLog} closed`)
        return Promise.reject(
          new Error(`${platformTypeForLog} unexpectedtly closed while executing ${file}`),
        )
      }
      // executed
      // should I call child.disconnect() at some point ?
      // https://nodejs.org/api/child_process.html#child_process_subprocess_disconnect
      log(`${file} execution on ${platformTypeForLog} done with ${value}`)
      return value
    }

    return startPlatform()
  }

  return executeFile
}
