import assert from "assert"
import fetch from "node-fetch"
import { open } from "./server.js"
import { createCancellationSource } from "../cancel/index.js"

const { cancel, token } = createCancellationSource()

open({
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
  .then(({ origin, agent, close }) => {
    assert.deepEqual(origin, "http://127.0.0.1:8998")

    return fetch(origin, { agent })
      .then((response) => response.text())
      .then((text) => {
        assert.equal(text, "ok")
        return close()
      })
  })
  .then(() => {
    console.log("passed")
  })

const timer = setTimeout(() => {}, 100000000)
token.register(() => {
  clearTimeout(timer)
})

process.on("SIGINT", () => {
  cancel("process interrupt").then(() => {
    process.exit(0)
  })
})

// we should test than close/cancel server gives expected response client side
// test(() => {
// 	return startServer({
// 		url: "http://localhost:0",
// 	}).then(({ nodeServer }) => {
// 		const { child } = isolateRequestHandler(nodeServer, (request, response) => {})
// 		child.kill()
// 	})
// })
