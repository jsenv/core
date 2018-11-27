import assert from "assert"
import { createPromiseAndHooks } from "../promiseHelper.js"
import { launchPlatformToExecuteFile } from "./launchPlatformToExecuteFile.js"
import { createRestartSource } from "./restartable.js"

const createFakePlatform = () => {
  const platform = {
    started: createPromiseAndHooks(),
    errored: createPromiseAndHooks(),
    closed: createPromiseAndHooks(),
    executed: createPromiseAndHooks(),
    close: () => platform.closed,
    fileToExecuted: () => platform.executed,
  }

  return platform
}

const test = async () => {
  // executed resolved
  {
    const platform = createFakePlatform()
    const launchPlatform = () => platform
    const executeFile = launchPlatformToExecuteFile(launchPlatform)

    platform.started.resolve()
    platform.executed.resolve(10)
    const result = await executeFile("file.js")
    assert.deepEqual(result, 10)
  }

  // executed rejected
  {
    const platform = createFakePlatform()
    const launchPlatform = () => platform
    const executeFile = launchPlatformToExecuteFile(launchPlatform)

    platform.started.resolve()
    platform.executed.reject(10)
    try {
      await executeFile("file.js")
      assert.fail("must not be called")
    } catch (error) {
      assert.deepEqual(error, 10)
    }
  }

  // restart before fileExecuted
  {
    const firstPlatform = createFakePlatform()
    const secondPlatform = createFakePlatform()()
    let callIndex = 0
    const launchPlatform = () => {
      callIndex++
      return callIndex === 1 ? firstPlatform : secondPlatform
    }
    const restartSource = createRestartSource()
    const executeFile = launchPlatformToExecuteFile(launchPlatform)

    firstPlatform.started.resolve()
    const firstExecuted = executeFile("file.js", { restartHook: restartSource.hook })
    await new Promise((resolve) => setTimeout(resolve, 10))
    const restarted = restartSource.restart("restart")
    firstPlatform.closed.resolve()

    secondPlatform.started.resolve()
    const secondExecuted = executeFile("file.js")
    secondPlatform.executed.resolve(10)

    const firstValue = await firstExecuted
    const secondValue = await secondExecuted
    const restartValue = await restarted

    assert.deepEqual(secondValue, 10)
    assert.deepEqual(firstValue, 10)
    assert.deepEqual(restartValue, 10)
  }

  console.log("passed")
}

test()
