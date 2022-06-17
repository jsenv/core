import { assert } from "@jsenv/assert"

import { startServer, fetchUrl } from "@jsenv/server"
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js"

// throw a primitive in requestToResponse
{
  const { origin, stop } = await startServer({
    logLevel: "off",
    protocol: "http",
    keepProcessAlive: false,
    requestToResponse: () => {
      // eslint-disable-next-line no-throw-literal
      throw "here"
    },
  })
  {
    const response = await fetchUrl(origin, {
      headers: {
        accept: "application/json",
      },
    })
    const actual = {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
      body: await response.text(),
    }
    const body = JSON.stringify({
      code: "VALUE_THROWED",
      value: "here",
    })
    const expected = {
      url: `${origin}/`,
      status: 500,
      statusText: "Internal Server Error",
      headers: {
        "cache-control": "no-store",
        "connection": "close",
        "content-length": String(Buffer.byteLength(body)),
        "content-type": "application/json",
        "date": actual.headers.date,
      },
      body,
    }
    assert({ actual, expected })
    stop()
  }
}

// throw an error in requestToResponse
{
  const { origin, stop } = await startServer({
    logLevel: "off",
    protocol: "http",
    keepProcessAlive: false,
    requestToResponse: () => {
      const error = new Error("message")
      error.code = "TEST_CODE"
      throw error
    },
  })
  {
    const response = await fetchUrl(origin, {
      headers: {
        accept: "application/json",
      },
    })
    const actual = {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
      body: await response.text(),
    }
    const body = JSON.stringify({
      code: "TEST_CODE",
    })
    const expected = {
      url: `${origin}/`,
      status: 500,
      statusText: "Internal Server Error",
      headers: {
        "cache-control": "no-store",
        "connection": "close",
        "content-length": String(Buffer.byteLength(body)),
        "content-type": "application/json",
        "date": actual.headers.date,
      },
      body,
    }
    assert({ actual, expected })
    stop()
  }
}
