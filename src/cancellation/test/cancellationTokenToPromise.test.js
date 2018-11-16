import { cancellationTokenToPromise, createCancellationSource } from "../index.js"
import assert from "assert"

{
  const test = async () => {
    const { token, cancel } = createCancellationSource()

    cancel("cancel")
    cancellationTokenToPromise(token).then(() => {
      assert.fail("must not be called")
    })
  }
  test()
}

console.log("passed")
