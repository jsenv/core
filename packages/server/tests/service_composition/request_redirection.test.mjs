import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/fetch"

import { startServer } from "@jsenv/server"

const { origin } = await startServer({
  logLevel: "warn",
  protocol: "http",
  keepProcessAlive: false,
  services: [
    {
      name: "redirect",
      redirectRequest: () => {
        // you're not allowed to mutate a request object
        // however in some specific cirsumtances in can be handy to mutate the request
        // that will be used for services coming after a given service
        return {
          pathname: "/toto.js",
        }
      },
    },
    {
      name: "otherwise",
      handleRequest: (request) => {
        return {
          status: 200,
          headers: {
            "Content-Type": "text/plain",
          },
          body: request.resource,
        }
      },
    },
  ],
})
const response = await fetchUrl(origin)
const actual = await response.text()
const expected = "/toto.js"
assert({ actual, expected })
