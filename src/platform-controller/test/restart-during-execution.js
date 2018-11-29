import assert from "assert"
import { launchPlatformToExecuteFile } from "../launchPlatformToExecuteFile.js"
import { createRestartController } from "../restartController.js"
import { createFakePlatform } from "./fixtures.js"
import { expectZeroUnhandledRejection } from "../../expectZeroUnhandledRejection.js"

expectZeroUnhandledRejection()

const createMaterial = () => {
  const firstPlatform = createFakePlatform()
  const secondPlatform = createFakePlatform()
  let callIndex = 0
  const launchPlatform = () => {
    callIndex++
    return callIndex === 1 ? firstPlatform : secondPlatform
  }
  const restartController = createRestartController()
  const executeFile = launchPlatformToExecuteFile(launchPlatform)
  const executed = executeFile("file.js", { restartSignal: restartController.signal })
  return { firstPlatform, secondPlatform, executed, restart: restartController.restart }
}

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

/*
hot reloading will work that way:

we listen for file change.
we track file currently being executed.
we create a restart controller per file execution
we create a cancel token per file execution

if the file is modified while being executed we call the restart controller.
if the file is executed we call cancel on file execution in case platform must be closed.
Because the current running file may have side effect until it's completely closed
we wait for cancel to resolve before calling executeFile.
*/

const test = async () => {
  // platorm opened rejection
  {
    const { firstPlatform, secondPlatform, executed, restart } = createMaterial()
    firstPlatform.opened.reject()

    try {
      await firstPlatform.opened
      assert.fail("")
    } catch (e) {}
  }

  // file executed rejection
  {
    const { firstPlatform, secondPlatform, executed, restart } = createMaterial()

    firstPlatform.opened.resolve()
    await firstPlatform.opened
    await wait() // seems to be required otherwise restartable.open not called yet
    restart("restart")
    firstPlatform.executed.reject("foo") // this is ignored because restart called before

    firstPlatform.closed.resolve()
    secondPlatform.opened.resolve()
    secondPlatform.executed.resolve(2)

    const value = await executed

    assert.deepEqual(value, 2)
  }

  // platform closed rejection
  {
    const { firstPlatform, restart, executed } = createMaterial()
    firstPlatform.opened.resolve()
    await firstPlatform.opened
    await wait()
    restart("restart")
    const error = new Error("here")
    await wait()
    firstPlatform.closed.reject(error)
    firstPlatform.closed.boo = true

    try {
      await executed
      assert.fail("must not be called")
    } catch (e) {
      assert.deepEqual(e, error)
    }
  }

  // - executed resolves
  // - plaform closed resolves
  // - second platform opened resolves
  // - second file executed resolves
  // {
  //   const { firstPlatform, secondPlatform, executed, restart } = createMaterial()

  //   firstPlatform.opened.resolve()
  //   await new Promise((resolve) => setTimeout(resolve, 10))
  //   const restarted = restart("restart")
  //   firstPlatform.executed.resolve(1)
  //   firstPlatform.closed.resolve()

  //   secondPlatform.opened.resolve()
  //   secondPlatform.executed.resolve(2)

  //   const executedValue = await executed
  //   const restartValue = await restarted

  //   assert.deepEqual(executedValue, 2)
  //   assert.deepEqual(restartValue, 2)
  // }
}

test()
