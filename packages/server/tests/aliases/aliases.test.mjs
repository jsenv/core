import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/fetch"

import {
  startServer,
  fetchFileSystem,
  jsenvServiceRequestAliases,
} from "@jsenv/server"

let resourceBeforeAlias
let resource
const { origin } = await startServer({
  logLevel: "error",
  keepProcessAlive: false,
  services: [
    jsenvServiceRequestAliases({
      "/alias.json": "/data.json",
      "/*.js": "/file.js",
      "/dir/*": "/dir/a.txt",
      "/*/deep/*.js": "/*/deep/file.js",
    }),
    {
      handleRequest: (request) => {
        resourceBeforeAlias = request.original
          ? request.original.resource
          : undefined
        resource = request.resource
        return fetchFileSystem(
          new URL(request.resource.slice(1), import.meta.url),
        )
      },
    },
  ],
})

{
  const response = await fetchUrl(`${origin}/src/deep/whatever.js`)
  const actual = {
    resourceBeforeAlias,
    resource,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  }
  const expected = {
    resourceBeforeAlias: "/src/deep/whatever.js",
    resource: "/src/deep/file.js",
    status: 200,
    headers: {
      "content-type": "text/javascript",
    },
  }
  assert({ actual, expected })
}

{
  const response = await fetchUrl(`${origin}/alias.json?foo=foo&test=1`)
  const actual = {
    resourceBeforeAlias,
    resource,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  }
  const expected = {
    resourceBeforeAlias: "/alias.json?foo=foo&test=1",
    resource: "/data.json?foo=foo&test=1",
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
    resourceBeforeAlias,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  }
  const expected = {
    resourceBeforeAlias: "/diuei.js",
    status: 200,
    headers: {
      "content-type": "text/javascript",
    },
  }
  assert({ actual, expected })
}

{
  const response = await fetchUrl(`${origin}/diuei.js/`)
  const actual = {
    resourceBeforeAlias,
    status: response.status,
  }
  const expected = {
    resourceBeforeAlias: undefined,
    status: 404,
  }
  assert({ actual, expected })
}

{
  const response = await fetchUrl(`${origin}/dir/toto`)
  const actual = {
    resourceBeforeAlias,
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type"),
    },
  }
  const expected = {
    resourceBeforeAlias: "/dir/toto",
    status: 200,
    headers: {
      "content-type": "text/plain",
    },
  }
  assert({ actual, expected })
}
