import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/fetch"

import { startServer } from "@jsenv/server"
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js"

{
  const server = await startServer({
    logLevel: "warn",
    protocol: "http",
    keepProcessAlive: false,
    port: 8998,
    services: [
      {
        handleRequest: () => {
          return {
            status: 200,
            headers: {
              "Content-Type": "text/plain",
            },
            body: "ok",
          }
        },
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
    url: `${server.origin}/`,
    status: 200,
    statusText: "OK",
    headers: {
      "connection": "close",
      "content-type": "text/plain",
      "date": actual.headers.date,
      "transfer-encoding": "chunked",
    },
    body: "ok",
  }
  assert({ actual, expected })
}

// can be calld without arg, returns 501
{
  const server = await startServer({
    logLevel: "off",
  })
  try {
    const response = await fetchUrl(server.origin)
    const actual = {
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
      size: response.size,
    }
    const expected = {
      status: 501,
      statusText: "Not Implemented",
      headers: {
        "connection": "close",
        "date": actual.headers.date,
        "transfer-encoding": "chunked",
      },
      size: 0,
    }
    assert({ actual, expected })
  } finally {
    await server.stop()
  }
}
