import { assert } from "@jsenv/assert"

import { startServer, readRequestBody, fetchUrl } from "@jsenv/server"

// read request body as string
{
  let requestBody
  const { origin } = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    requestToResponse: async (request) => {
      requestBody = await readRequestBody(request)
      return {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
        body: "",
      }
    },
  })
  await fetchUrl(origin, {
    method: "POST",
    body: "toto",
  })
  const actual = requestBody
  const expected = "toto"
  assert({ actual, expected })
}

// read request body as json
{
  let requestBody
  const { origin } = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    requestToResponse: async (request) => {
      requestBody = await readRequestBody(request, { as: "json" })

      return {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
        body: "",
      }
    },
  })

  await fetchUrl(origin, {
    method: "PUT",
    body: JSON.stringify({ foo: true }),
  })
  const actual = requestBody
  const expected = { foo: true }
  assert({ actual, expected })
}

// read request body as buffer
{
  let requestBody
  const { origin } = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    requestToResponse: async (request) => {
      requestBody = await readRequestBody(request, { as: "buffer" })

      return {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
        body: "",
      }
    },
  })
  await fetchUrl(origin, {
    method: "PATCH",
    body: "toto",
  })
  const actual = requestBody
  const expected = Buffer.from("toto")
  assert({ actual, expected })
}

// read request body a bit late
{
  let requestBody
  let resolveReadPromise
  const readPromise = new Promise((resolve) => {
    resolveReadPromise = resolve
  })
  const { origin } = await startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    requestToResponse: async (request) => {
      await readPromise
      requestBody = await readRequestBody(request, { as: "string" })
      return {
        status: 200,
        headers: {
          "Content-Type": "text/plain",
        },
        body: "",
      }
    },
  })
  const responsePromise = fetchUrl(origin, {
    method: "POST",
    body: "toto",
  })
  // wait Xms before reading the request body
  await new Promise((resolve) => setTimeout(resolve, 200))
  resolveReadPromise()
  await responsePromise
  const actual = requestBody
  const expected = "toto"
  assert({ actual, expected })
}
