import {
  createCancellationToken,
  cancellationTokenCompose,
  cancellationTokenToPromise,
  createOperation,
} from "@dmail/cancellation"
import { promiseTrackRace } from "../promiseHelper.js"
// import { hotreloadOpen } from "./hotreload.js"
import { createRestartHook, createRestartable } from "./restartable.js"

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
      restartHook = createRestartHook(),
      instrument = false,
      setup = () => {},
      teardown = () => {},
    } = {},
  ) => {
    const executionCancellationToken = cancellationTokenCompose(
      platformCancellationToken,
      cancellationToken,
    )

    const restartable = createRestartable()
    restartable.onopen = (reason) => {
      log(`open restart because ${reason}`)
    }
    restartable.onclose = (reason) => {
      log(`close restart because ${reason}`)
    }
    // si je hotreload je l'écoute que ici apres tout
    // restartable.addToken(hotreloadRestartSource.token)
    restartable.addHook(restartHook)

    const startPlatform = async () => {
      executionCancellationToken.throwIfRequested()

      log(`start ${platformTypeForLog} to execute ${file}`)
      const { started, errored, closed, close, closeForce, fileToExecuted } = await launchPlatform()

      const platformOperation = createOperation({
        cancellationToken: executionCancellationToken,
        promise: started,
        stop: (reason) => {
          log(`stop ${platformTypeForLog}`)
          close(reason)

          const stopped = Promise.race([errored, closed])
          if (closeForce) {
            const id = setTimeout(closeForce, ALLOCATED_MS_FOR_CLOSE)
            stopped.then(() => clearTimeout(id))
          }
          return stopped
        },
      })

      await platformOperation

      log(`execute ${file} on ${platformTypeForLog}`)
      const executed = fileToExecuted(file, { instrument, setup, teardown })

      const restarting = new Promise((resolve) => restartable.onrestart(resolve))
      // if we cancel, prevent restart
      const restartableCloseRegistration = cancellationToken.register(restartable.close)
      restartable.open((reason) => {
        restartableCloseRegistration.unregister()
        return platformOperation.stop(reason).then(startPlatform)
      })

      const { winner, value } = await promiseTrackRace([
        // cancellationTokenToPromise will reject with a cancelError to prevent
        // and prevent other promise to happen
        cancellationTokenToPromise(executionCancellationToken),
        restarting,
        errored,
        closed,
        executed,
      ])

      if (winner === restarting) {
        return value.restartReturnValue
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
