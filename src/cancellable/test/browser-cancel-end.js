import { cancellable } from "../cancellable.js"
import assert from "assert"

const calls = []

const serverCompile = {}
const server = {}

const serverCompileOpen = () =>
  cancellable((cleanup) => {
    cleanup(() => {
      calls.push("kill compile server")
    })
    return serverCompile
  })

const serverOpen = () =>
  cancellable((cleanup) => {
    cleanup(() => {
      calls.push("kill server")
    })
    return server
  })

const serverBrowserOpen = () => {
  return serverCompileOpen().then((serverCompile) => {
    return serverOpen().then((server) => {
      return {
        serverCompile,
        server,
      }
    })
  })
}

const execution = serverBrowserOpen()

execution.then((actual) => {
  const expected = { serverCompile, server }
  assert.deepEqual(actual, expected)

  execution.cancel().then(() => {
    const actual = calls
    const expected = ["kill-server", "kill-compile-server"]
    assert.deepEqual(actual, expected)
    console.log("passed")
  })
})
