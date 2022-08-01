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

# Examples

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
        if (request.resource === "/") {
          return { status: 200 }
        }
        return null
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
  certificate: readFileSync(new URL("./server.crt", import.meta.url), "utf8"),
  privateKey: readFileSync(new URL("./server.key", import.meta.url), "utf8"),
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
```

_Code starting a server for static files:_

```js
import { startServer, fetchFileSystem } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: async (request) => {
        const fileUrl = new URL(request.resource.slice(1), import.meta.url)
        const response = await fetchFileSystem(fileUrl, request)
        return response
      },
    },
  ],
})
```

# Documentation

- [Handling requests](./docs/handling_requests.md)
- [Handling errors](./docs/handling_errors.md)
- [Server timing](./docs/server_timing.md)
- [CORS](./docs/cors.md)
- [https](./docs/https.md)
- [Serving files](./docs/serving_files.md)
- [Content negotiation](./docs/content_negotiation.md)
- [Websocket](./docs/websocket.md)
- [Server Sent Events](./docs/server_sent_events.md)
- [Cluster](./docs/cluster.md)
- [Http2 push](./docs/http2_push.md)

# Installation

```console
npm install @jsenv/server
```
