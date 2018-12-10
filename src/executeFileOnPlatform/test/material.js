import { createCancellationSource } from "@dmail/cancellation"
import { createPromiseAndHooks } from "../../promiseHelper.js"
import { executeFileOnPlatform } from "../executeFileOnPlatform.js"
import { createRestartController } from "../restartController.js"

export const createFakePlatform = () => {
  const executed = createPromiseAndHooks()
  const platform = {
    opened: createPromiseAndHooks(),
    closed: createPromiseAndHooks(),
    executed,
    fileToExecuted: () => executed,
    close: (reason) => {
      platform.closed.resolve(reason)
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
  const execution = executeFileOnPlatform("file.js", {
    launchPlatform,
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
