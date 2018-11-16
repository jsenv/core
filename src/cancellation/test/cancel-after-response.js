import { createCancellationSource } from "../../cancellation/index.js"
import { startServer, requestServer } from "./fixtures.js"
import assert from "assert"

{
  const { token: cancellationToken, cancel } = createCancellationSource()

  const exec = async () => {
    const serverPromise = startServer({ cancellationToken })
    await serverPromise
    const responsePromise = requestServer({ cancellationToken })
    return await responsePromise
  }
  exec().then(({ statusCode }) => {
    assert.equal(statusCode, 200)
    cancel("cancel").then((values) => {
      assert.deepEqual(values, ["server closed because cancel"])
      console.log("passed")
    })
  })
}
