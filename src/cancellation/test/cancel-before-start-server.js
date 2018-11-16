import { createCancellationSource } from "../../cancellation/index.js"
import { startServer, requestServer } from "./fixtures.js"
import assert from "assert"

{
  const { token: cancellationToken, cancel } = createCancellationSource()
  const exec = async () => {
    cancel("cancel").then((values) => {
      assert.deepEqual(values, [])
    })
    const serverPromise = startServer({ cancellationToken })
    await serverPromise
    const responsePromise = requestServer({ cancellationToken })
    return responsePromise
  }
  exec().then(() => {
    assert.fail("must not be called")
    console.log("passed")
  })
}
