import assert from "assert"
import fetch from "node-fetch"
import { openServer } from "./openServer.js"

openServer({
  protocol: "http",
  port: 8998,
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

// ici on testera que quand on kill le child à différent moment
// on obtient bien la réponse attendu coté client
// test(() => {
// 	return startServer({
// 		url: "http://localhost:0",
// 	}).then(({ nodeServer }) => {
// 		const { child } = isolateRequestHandler(nodeServer, (request, response) => {})
// 		child.kill()
// 	})
// })
