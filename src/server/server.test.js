import { createCancellationSource } from "/node_modules/@dmail/cancellation/index.js"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { startServer } from "./server.js"

const fetch = import.meta.require("node-fetch")

const test = async () => {
  const { cancel, token } = createCancellationSource()

  const timer = setTimeout(() => {}, 100000000)
  token.register(() => {
    clearTimeout(timer)
  })
  process.on("SIGINT", () => cancel("process interrupt"))

  const { origin, agent, stop } = await startServer({
    cancellationToken: token,
    protocol: "http",
    port: 8998,
    verbose: true,
    requestToResponse: () => {
      return {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
        body: "ok",
      }
    },
  })
  assert({ actual: origin, expected: "http://127.0.0.1:8998" })

  const response = await fetch(origin, { agent })
  const text = await response.text()
  assert({ actual: text, expected: "ok" })

  stop()
  cancel("done")
}
test()

// we should test than close/cancel server gives expected response client side
// test(() => {
// 	return startServer({
// 		url: "http://localhost:0",
// 	}).then(({ nodeServer }) => {
// 		const { child } = isolateRequestHandler(nodeServer, (request, response) => {})
// 		child.kill()
// 	})
// })
