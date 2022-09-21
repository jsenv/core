import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/fetch"

import { startServer } from "@jsenv/server"
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js"

const server = await startServer({
  logLevel: "info",
  keepProcessAlive: false,
  services: [
    {
      handleRequest: (request) => {},
    },
  ],
})

const response = await fetchUrl(server.origin)
const actual = {
  url: response.url,
  status: response.status,
  statusText: response.statusText,
  headers: headersToObject(response.headers),
  body: await response.text(),
}
const expected = {
  url: `${origin}/`,
  status: 501,
  statusText: "Not Implemented",
  headers: {
    "connection": "close",
    "date": actual.headers.date,
    "transfer-encoding": "chunked",
  },
  body: "",
}
assert({ actual, expected })
