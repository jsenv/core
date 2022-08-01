import { assert } from "@jsenv/assert"
import { fetchUrl } from "@jsenv/fetch"

import { startServer, fetchFileSystem } from "@jsenv/server"
import { headersToObject } from "@jsenv/server/src/internal/headersToObject.js"

const testDirectoryUrl = new URL("./", import.meta.url).href

const server = await startServer({
  logLevel: "warn",
  keepProcessAlive: false,
  services: [
    {
      handleRequest: (request) => {
        return fetchFileSystem(
          new URL(request.resource.slice(1), import.meta.url),
          {
            headers: request.headers,
            canReadDirectory: true,
            rootDirectoryUrl: testDirectoryUrl,
          },
        )
      },
    },
  ],
})

const directoryUrl = new URL("./dir/", testDirectoryUrl).href
const requestUrl = new URL("/dir/", server.origin).href
const response = await fetchUrl(requestUrl, {
  headers: { accept: "text/html" },
})
const actual = {
  url: response.url,
  status: response.status,
  statusText: response.statusText,
  headers: headersToObject(response.headers),
  body: await response.text(),
}
const expectedBody = `<!DOCTYPE html>
<html>
  <head>
    <title>Directory explorer</title>
    <meta charset="utf-8" />
    <link rel="icon" href="data:," />
  </head>

  <body>
    <h1>Content of directory ${directoryUrl}</h1>
    <ul>
      <li>
        <a href="/dir/file.js">dir/file.js</a>
      </li>
    </ul>
  </body>
</html>`
const expected = {
  url: requestUrl,
  status: 200,
  statusText: "OK",
  headers: {
    "connection": "close",
    "content-length": `${expectedBody.length}`,
    "content-type": "text/html",
    "date": actual.headers.date,
  },
  body: expectedBody,
}
assert({ actual, expected })
