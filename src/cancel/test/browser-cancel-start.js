import { createCancel } from "../cancel.js"
import assert from "assert"

const calls = []

const serverCompile = {}
const server = {}

const serverCompileOpen = () => {
  const { cancellable, addCancelCallback } = createCancel()

  addCancelCallback(() => {
    calls.push("kill compile server")
  })
  return cancellable(Promise.resolve(serverCompile))
}

const serverOpen = () => {
  const { cancellable, addCancelCallback } = createCancel()

  addCancelCallback(() => {
    calls.push("kill server")
  })
  return cancellable(Promise.resolve(server))
}

const serverBrowserOpen = () => {
  const { cancellable } = createCancel()

  return cancellable(serverCompileOpen()).then((serverCompile) => {
    return cancellable(serverOpen()).then((server) => {
      return {
        serverCompile,
        server,
      }
    })
  })
}

const execution = serverBrowserOpen()

execution.cancel().then(() => {
  const actual = calls
  const expected = ["kill compile server"]
  assert.deepEqual(actual, expected)
  console.log("passed")
})

execution.then(() => {
  assert.fail("must not be called")
})
