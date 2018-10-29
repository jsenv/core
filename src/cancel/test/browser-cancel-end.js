import { createCancel } from "../cancel.js"
import assert from "assert"

const calls = []
const serverCompile = {}
const server = {}

const serverCompileOpen = (cancellation) => {
  return cancellation.wrap((register) => {
    register(() => {
      calls.push("kill compile server")
    })
    return Promise.resolve(serverCompile)
  })
}

const serverOpen = (cancellation) => {
  return cancellation.wrap((register) => {
    register(() => {
      calls.push("kill server")
    })
    return Promise.resolve(server)
  })
}

const serverBrowserOpen = (cancellation) => {
  return serverCompileOpen(cancellation).then((serverCompile) => {
    return serverOpen(cancellation).then((server) => {
      return {
        serverCompile,
        server,
      }
    })
  })
}

const { cancellation, cancel } = createCancel()
const execution = serverBrowserOpen(cancellation)

execution.then((actual) => {
  const expected = { serverCompile, server }
  assert.deepEqual(actual, expected)

  cancel().then(() => {
    const actual = calls
    const expected = ["kill server", "kill compile server"]
    assert.deepEqual(actual, expected)
    console.log("passed")
  })
})
