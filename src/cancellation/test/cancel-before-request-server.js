import { createCancellationSource } from "../../cancellation/index.js"
import { startServer, requestServer } from "./fixtures.js"
import assert from "assert"

{
  const { token: cancellationToken, cancel } = createCancellationSource()

  const exec = async () => {
    const serverPromise = startServer({ cancellationToken })
    await serverPromise
    cancel("cancel").then((values) => {
      assert.deepEqual(values, ["server closed because cancel"])
      console.log("passed")
    })
    const responsePromise = requestServer({ cancellationToken })
    await responsePromise
  }

  exec().then(() => {
    assert.fail("must not be called")
  })
}
