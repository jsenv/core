import { assert } from "@jsenv/assert"

import {
  startServer,
  fetchFileSystem,
  fetchUrl,
  pluginRessourceAliases,
} from "@jsenv/server"

let ressourceBeforeAlias
let ressource
const { origin } = await startServer({
  logLevel: "warn",
  protocol: "http",
  keepProcessAlive: false,
  plugins: {
    ...pluginRessourceAliases({
      "/alias.json": "/data.json",
      "/*.js": "/file.js",
      "/dir/*": "/dir/a.txt",
      "/*/deep/*.js": "/*/deep/file.js",
    }),
  },
  requestToResponse: (request) => {
    ressourceBeforeAlias = request.ressourceBeforeAlias
    ressource = request.ressource
    return fetchFileSystem(new URL(request.ressource.slice(1), import.meta.url))
  },
})

{
  const response = await fetchUrl(`${origin}/src/deep/whatever.js`)
  const actual = {
    ressourceBeforeAlias,
    ressource,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  }
  const expected = {
    ressourceBeforeAlias: "/src/deep/whatever.js",
    ressource: "/src/deep/file.js",
    status: 200,
    headers: {
      "content-type": "application/javascript",
    },
  }
  assert({ actual, expected })
}

{
  const response = await fetchUrl(`${origin}/alias.json?foo=foo&test=1`)
  const actual = {
    ressourceBeforeAlias,
    ressource,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  }
  const expected = {
    ressourceBeforeAlias: "/alias.json?foo=foo&test=1",
    ressource: "/data.json?foo=foo&test=1",
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  }
  assert({ actual, expected })
}

{
  const response = await fetchUrl(`${origin}/diuei.js`)
  const actual = {
    ressourceBeforeAlias,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  }
  const expected = {
    ressourceBeforeAlias: "/diuei.js",
    status: 200,
    headers: {
      "content-type": "application/javascript",
    },
  }
  assert({ actual, expected })
}

{
  const response = await fetchUrl(`${origin}/diuei.js/`)
  const actual = {
    ressourceBeforeAlias,
    status: response.status,
  }
  const expected = {
    ressourceBeforeAlias: undefined,
    status: 404,
  }
  assert({ actual, expected })
}

{
  const response = await fetchUrl(`${origin}/dir/toto`)
  const actual = {
    ressourceBeforeAlias,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  }
  const expected = {
    ressourceBeforeAlias: "/dir/toto",
    status: 200,
    headers: {
      "content-type": "text/plain",
    },
  }
  assert({ actual, expected })
}
