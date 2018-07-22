import { test } from "@dmail/test"
import assert from "assert"
import fetch from "node-fetch"
import { createNodeRequestHandler } from "./createNodeRequestHandler.js"
import { startServer } from "./startServer.js"

test(() => {
  return startServer().then(({ addRequestHandler, url, agent, close }) => {
    const nodeRequestHandler = createNodeRequestHandler({
      handler: () => {
        // as we can see the whole concept behind createNodeRequestHandler
        // is to avoid using response methods directly but rather
        // return POJO that takes care of using response methods
        return {
          status: 200,
          headers: {
            "content-length": 2,
          },
          body: "ok",
        }
      },
      url,
    })

    addRequestHandler(nodeRequestHandler)

    return fetch(url, { agent })
      .then((response) => response.text())
      .then((text) => {
        assert.equal(text, "ok")
        return close()
      })
  })
})
