# server [![npm package](https://img.shields.io/npm/v/@jsenv/server.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/server)

`@jsenv/server` helps to write flexible server code with a declarative API.

```js
import { startServer } from "@jsenv/server"

await startServer({
  protocol: "http",
  port: 8080,
  services: [
    {
      handleRequest: () => {
        return {
          status: 200,
          headers: {
            "content-type": "text/plain",
          },
          body: "Hello world",
        }
      },
    },
  ],
})
```

# Example

_Code starting a server and using [node-fetch](https://github.com/node-fetch/node-fetch) to send a request on that server:_

```js
import fetch from "node-fetch"
import { startServer } from "@jsenv/server"

const server = await startServer({
  services: [
    {
      handleRequest: () => {
        return {
          status: 200,
          headers: {
            "content-type": "text/plain",
          },
          body: "Hello world",
        }
      },
    },
  ],
})

const response = await fetch(server.origin)
const responseBodyAsText = await response.text()
console.log(responseBodyAsText) // "Hello world"
```

_Code starting a server with 2 request handlers:_

```js
/*
 * starts a server which:
 * - when requested at "/"
 *   -> respond with 200
 * - otherwise
 *   -> respond with 404
 */
import { startServer, composeServices } from "@jsenv/server"

const server = await startServer({
  services: [
    {
      name: "index",
      handleRequest: (request) => {
        if (request.ressource === "/") {
          return { status: 200 }
        }
        return null // means "I don't handle that request"
      },
    },
    {
      name: "otherwise",
      handleRequest: () => {
        return { status: 404 }
      },
    },
  ],
})

const fetch = await import("node-fetch")
const responseForOrigin = await fetch(server.origin)
responseForOrigin.status // 200

const responseForFoo = await fetch(`${server.origin}/foo`)
responseForFoo.status // 404
```

_Code starting a server in https:_

```js
import { readFileSync } from "node:fs"
import { startServer } from "@jsenv/server"

await startServer({
  protocol: "https",
  certificate: readFileSyncAsString("./server.crt"),
  privateKey: readFileSyncAsString("./server.key"),
  allowHttpRequestOnHttps: true,
  services: [
    {
      handleRequest: (request) => {
        const clientUsesHttp = request.origin.startsWith("http:")

        return {
          status: 200,
          headers: {
            "content-type": "text/plain",
          },
          body: clientUsesHttp ? `Welcome http user` : `Welcome https user`,
        }
      },
    },
  ],
})

function readFileSyncAsString(relativeUrl) {
  const fileUrl = new URL(relativeUrl, import.meta.url)
  return String(readFileSync(fileUrl))
}
```

_Code starting a server for static files:_

```js
import { startServer, fetchFileSystem } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: async (request) => {
        const fileUrl = new URL(request.ressource.slice(1), import.meta.url)
        const response = await fetchFileSystem(fileUrl, {
          ...request,
        })
        return response
      },
    },
  ],
})
```

# Documentation

- [https](./docs/https/https.md)
- [Serving files](./docs/serving_files/serving_files.md)
- [Handling requests](./docs/handling_requests/handling_requests.md)
- [Handling errors](./docs/handling_errors/handling_errors.md)
- [Server timing](./docs/server_timing/server_timing.md)
- [CORS](./docs/cors/cors.md)
- [Content negotiation](./docs/content_negotiation/content_negotiation.md)
- [Server Sent Events](./docs/sse/sse.md)
- [Cluster](./docs/cluster/cluster.md)
- [Http2 push](./docs/http2_push/http2_push.md)

# Installation

```console
npm install @jsenv/server
```
