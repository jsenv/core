import assert from "assert"
import { createPromiseAndHooks } from "../promiseHelper.js"
import { launchPlatformToExecute } from "./launchPlatformToExecute.js"

const createLaunchPlatformHook = () => {
  const errored = createPromiseAndHooks()
  const closed = createPromiseAndHooks()
  let closeReason
  const close = (reason) => {
    closeReason = reason
  }
  const done = createPromiseAndHooks()
  const executeFile = () => {
    return { done }
  }
  const launchPlatform = () => {
    return { errored, closed, close, executeFile }
  }

  return { errored, closed, close, done, getCloseReason: () => closeReason, launchPlatform }
}

const test = async () => {
  // done resolved
  {
    const { done, launchPlatform } = createLaunchPlatformHook()
    const execute = launchPlatformToExecute(launchPlatform)

    done.resolve(10)
    const result = await execute("file.js")
    assert.deepEqual(result, 10)
  }

  // done rejected
  {
    const { done, launchPlatform } = createLaunchPlatformHook()
    const execute = launchPlatformToExecute(launchPlatform)

    done.reject(10)
    try {
      await execute("file.js")
      assert.fail("must not be called")
    } catch (error) {
      assert.deepEqual(error, 10)
    }
  }

  // cancel prevent execute

  console.log("passed")
}

test()
