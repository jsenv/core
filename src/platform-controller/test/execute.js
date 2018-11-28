import assert from "assert"
import { launchPlatformToExecuteFile } from "../launchPlatformToExecuteFile.js"
import { createFakePlatform } from "./fixtures.js"
import { expectZeroUnhandledRejection } from "../../expectZeroUnhandledRejection.js"

expectZeroUnhandledRejection()

const createMaterial = () => {
  const platform = createFakePlatform()
  const launchPlatform = () => platform
  const executeFile = launchPlatformToExecuteFile(launchPlatform)
  const executed = executeFile("file.js")
  return { platform, executed }
}

const test = async () => {
  // executed rejects
  {
    const { platform, executed } = createMaterial()

    platform.opened.resolve()
    platform.executed.reject(10)
    try {
      await executed
      assert.fail("must not be called")
    } catch (error) {
      assert.deepEqual(error, 10)
    }
  }

  // executed resolves
  {
    const { platform, executed } = createMaterial()

    platform.opened.resolve()
    platform.executed.resolve(10)
    const value = await executed
    assert.deepEqual(value, 10)
  }

  console.log("passed")
}

test()
