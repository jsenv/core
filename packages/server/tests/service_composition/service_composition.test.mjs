import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/fetch"

import { startServer, composeServices } from "@jsenv/server"
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js"

const noContentService = (request) => {
  if (request.ressource !== "/") return null
  return { status: 204 }
}

const okService = (request) => {
  if (request.ressource !== "/whatever") return null
  return { status: 200 }
}

const { origin } = await startServer({
  keepProcessAlive: false,
  logLevel: "warn",
  requestToResponse: composeServices({
    noContentService,
    okService,
  }),
})

{
  const response = await fetchUrl(origin)
  const actual = {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    body: await response.text(),
  }
  const expected = {
    url: `${origin}/`,
    status: 204,
    statusText: "No Content",
    headers: {
      connection: "close",
      date: actual.headers.date,
    },
    body: "",
  }
  assert({ actual, expected })
}

{
  const response = await fetchUrl(`${origin}/whatever`)
  const actual = {
    url: response.url,
    status: response.status,
    statusText: response.statusText,
    headers: headersToObject(response.headers),
    body: await response.text(),
  }
  const expected = {
    url: `${origin}/whatever`,
    status: 200,
    statusText: "OK",
    headers: {
      "connection": "close",
      "date": actual.headers.date,
      "transfer-encoding": "chunked",
    },
    body: "",
  }
  assert({ actual, expected })
}
