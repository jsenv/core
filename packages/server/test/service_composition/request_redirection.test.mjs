import { assert } from "@jsenv/assert"

import { startServer, composeServices, fetchUrl } from "@jsenv/server"

const { origin } = await startServer({
  logLevel: "warn",
  protocol: "http",
  keepProcessAlive: false,
  ip: "",
  requestToResponse: composeServices({
    redirect: (request, { redirectRequest }) => {
      // you're not allowed to mutate a request object
      // however in some specific cirsumtances in can be handy to mutate the request
      // that will be used for services coming after a given service
      redirectRequest({
        pathname: "/toto.js",
      })
    },
    otherwise: (request) => {
      return {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
        body: request.ressource,
      }
    },
  }),
})

const response = await fetchUrl(origin)

const actual = await response.text()
const expected = "/toto.js"
assert({ actual, expected })
