import { createCancellationSource } from "@dmail/cancellation"
import { createPromiseAndHooks } from "../../promiseHelper.js"
import { launchAndExecute } from "../launchAndExecute.js"
import { createRestartController } from "../restartController.js"

export const createFakePlatform = () => {
  const platform = {
    started: createPromiseAndHooks(),
    disconnected: createPromiseAndHooks(),
    executed: createPromiseAndHooks(),
    fileToExecuted: () => platform.executed,
    stop: (reason) => {
      platform.disconnected.resolve(reason)
    },
  }

  return platform
}

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

export const createMaterial = () => {
  const firstPlatform = createFakePlatform()
  const secondPlatform = createFakePlatform()
  let callIndex = 0
  const launchPlatform = () => {
    callIndex++
    return callIndex === 1 ? firstPlatform : secondPlatform
  }
  const cancellationSource = createCancellationSource()
  const restartController = createRestartController()
  const execution = launchAndExecute(launchPlatform, "file.js", {
    restartSignal: restartController.signal,
    cancellationToken: cancellationSource.token,
  })
  return {
    execution,
    restart: restartController.restart,
    cancel: cancellationSource.cancel,
    wait,
    firstPlatform,
    secondPlatform,
  }
}
