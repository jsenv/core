import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/fetch"

import {
  startServer,
  jsenvServiceCORS,
  jsenvServiceErrorHandler,
} from "@jsenv/server"
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js"

const server = await startServer({
  logLevel: "off",
  keepProcessAlive: false,
  services: [
    jsenvServiceCORS({
      accessControlAllowedMethods: [],
      accessControlAllowRequestOrigin: true,
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
      accessControlMaxAge: 400,
    }),
    jsenvServiceErrorHandler(),
    {
      handleRequest: () => {
        throw new Error("here")
      },
    },
  ],
})

const response = await fetchUrl(server.origin, {
  method: "GET",
  headers: {
    "accept": "",
    "origin": "http://example.com:80",
    "access-control-request-method": "GET",
    "access-control-request-headers": "x-whatever",
  },
})
const actual = {
  url: response.url,
  status: response.status,
  statusText: response.statusText,
  headers: headersToObject(response.headers),
  body: await response.text(),
}
const body = JSON.stringify({ code: "UNKNOWN_ERROR" })
const expected = {
  url: `${server.origin}/`,
  status: 500,
  statusText: "Internal Server Error",
  headers: {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "x-requested-with, x-whatever",
    "access-control-allow-methods": "GET",
    "access-control-allow-origin": "http://example.com:80",
    "access-control-max-age": "400",
    "cache-control": "no-store",
    "connection": "close",
    "content-length": String(Buffer.byteLength(body)),
    "content-type": "application/json",
    "date": actual.headers.date,
    "vary":
      "origin, access-control-request-method, access-control-request-headers",
  },
  body,
}
assert({ actual, expected })
