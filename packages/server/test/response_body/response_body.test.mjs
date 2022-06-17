import { assert } from "@jsenv/assert"
import { promises } from "node:fs"

import {
  startServer,
  fetchUrl,
  composeServices,
  fromFetchResponse,
} from "@jsenv/server"

// file handle
{
  const server = await startServer({
    keepProcessAlive: false,
    logLevel: "warn",
    requestToResponse: async () => {
      const response = {
        status: 200,
        headers: { "content-type": "text/plain" },
        body: await promises.open(new URL("./file.txt", import.meta.url), "r"),
      }
      return response
    },
  })
  const response = await fetchUrl(server.origin)

  const actual = await response.text()
  const expected = "Hello"
  assert({ actual, expected })

  // node-fetch response
  {
    const serverB = await startServer({
      keepProcessAlive: false,
      logLevel: "warn",
      requestToResponse: composeServices({
        test: async () => {
          const response = await fetchUrl(server.origin)
          return fromFetchResponse(response)
        },
      }),
    })
    const response = await fetchUrl(serverB.origin)
    const actual = await response.text()
    const expected = "Hello"
    assert({ actual, expected })
  }
}
