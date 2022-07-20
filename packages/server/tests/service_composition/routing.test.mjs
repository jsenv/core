import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/fetch"

import { startServer, setupRoutes } from "@jsenv/server"

const { origin } = await startServer({
  keepProcessAlive: false,
  logLevel: "warn",
  services: [
    {
      handleRequest: setupRoutes({
        "/a.js": () => {
          return {
            status: 200,
            body: "a.js",
          }
        },
        "/:id.js": ({ routeParams }) => {
          return {
            status: 200,
            body: `${routeParams.id}.js`,
          }
        },
      }),
    },
  ],
})

{
  const response = await fetchUrl(`${origin}/a.js`)
  const actual = {
    status: response.status,
    body: await response.text(),
  }
  const expected = {
    status: 200,
    body: "a.js",
  }
  assert({ actual, expected })
}

{
  const response = await fetchUrl(`${origin}/a.js?foo=true`)
  const actual = {
    status: response.status,
    body: await response.text(),
  }
  const expected = {
    status: 200,
    body: "a.js",
  }
  assert({ actual, expected })
}

{
  const response = await fetchUrl(`${origin}/34rtys.js`)
  const actual = {
    status: response.status,
    body: await response.text(),
  }
  const expected = {
    status: 200,
    body: "34rtys.js",
  }
  assert({ actual, expected })
}
