import assert from "assert"
import { createPromiseAndHooks } from "../promiseHelper.js"
import { launchPlatformToExecute } from "./launchPlatformToExecute.js"

const createLaunchPlatformHook = () => {
  const started = createPromiseAndHooks()
  const errored = createPromiseAndHooks()
  const closed = createPromiseAndHooks()
  let closeReason
  const close = (reason) => {
    closeReason = reason
  }
  const fileExecuted = createPromiseAndHooks()
  const executeFile = () => {
    return { fileExecuted }
  }
  const launchPlatform = () => {
    return { started, errored, closed, close, executeFile }
  }

  return {
    started,
    errored,
    closed,
    close,
    fileExecuted,
    getCloseReason: () => closeReason,
    launchPlatform,
  }
}

const test = async () => {
  // fileExecuted resolved
  {
    const { started, fileExecuted, launchPlatform } = createLaunchPlatformHook()
    const execute = launchPlatformToExecute(launchPlatform)

    started.resolve()
    fileExecuted.resolve(10)
    const result = await execute("file.js")
    assert.deepEqual(result, 10)
  }

  // fileExecuted rejected
  {
    const { started, fileExecuted, launchPlatform } = createLaunchPlatformHook()
    const execute = launchPlatformToExecute(launchPlatform)

    started.resolve()
    fileExecuted.reject(10)
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
