import { assert } from "@jsenv/assert"

import { startServer, readRequestBody } from "@jsenv/server"
import { fetchUsingNodeBuiltin } from "@jsenv/server/tests/test_helpers.mjs"

const { origin } = await startServer({
  keepProcessAlive: false,
  logLevel: "warn",
  requestToResponse: async (request) => {
    const requestBody = await readRequestBody(request, { as: "string" })
    const responseBody = `${requestBody} world`
    return {
      status: 200,
      headers: {
        "content-length": Buffer.byteLength(responseBody),
      },
      body: responseBody,
    }
  },
})
const response = await fetchUsingNodeBuiltin(origin, { body: "Hello" })

const actual = await response.text()
const expected = "Hello world"
assert({ actual, expected })
