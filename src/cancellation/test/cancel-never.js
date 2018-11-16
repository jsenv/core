import { startServer, requestServer } from "./fixtures.js"
import assert from "assert"

{
  const exec = async () => {
    const serverPromise = startServer()
    await serverPromise
    const responsePromise = requestServer()
    return responsePromise
  }
  exec().then(({ statusCode }) => {
    assert.equal(statusCode, 200)
    console.log("passed")
  })
}
