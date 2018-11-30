import { createPromiseAndHooks } from "../../promiseHelper.js"
import { launchPlatformToExecuteFile } from "../launchPlatformToExecuteFile.js"
import { createRestartController } from "../restartController.js"

export const createFakePlatform = () => {
  const executed = createPromiseAndHooks()
  const platform = {
    opened: createPromiseAndHooks(),
    closed: createPromiseAndHooks(),
    executed,
    fileToExecuted: () => executed,
    close: () => {},
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
  const restartController = createRestartController()
  const executeFile = launchPlatformToExecuteFile(launchPlatform)
  const execution = executeFile("file.js", { restartSignal: restartController.signal })
  return { execution, restart: restartController.restart, wait, firstPlatform, secondPlatform }
}
