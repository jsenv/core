# server [![npm package](https://img.shields.io/npm/v/@jsenv/server.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/server)

> A Node.js HTTP server with declarative routing, content negotiation, file serving, WebSocket and Server-Sent Events.

```js
import { startServer } from "@jsenv/server";

await startServer({
  port: 8080,
  routes: [
    {
      endpoint: "GET *",
      fetch: () => new Response("Hello world"),
    },
  ],
});
```

# Features

- Declarative routing: `"GET /users/:id"`, the first route returning a response wins
- 404, 405, 406, 415 and OPTIONS responses derived from the routes
- Content negotiation for media type, language, version and encoding
- File serving with etag/mtime client cache and compression
- WebSocket and Server-Sent Events, with a broadcast helper
- HTTPS, with http → https redirection; http2 as an option
- CORS, server timing and error pages as plugins
- Host header check (DNS rebinding) and bounded request bodies
- A route inspector at `/.internal/route_inspector`

# Installation

```console
npm install @jsenv/server
```

Requires Node.js 22.13.1 or higher.

# Quick examples

**API server**

```js
import { startServer } from "@jsenv/server";

await startServer({
  port: 3000,
  routes: [
    {
      endpoint: "GET /api/users",
      fetch: () => Response.json([{ id: 1, name: "John" }]),
    },
    {
      endpoint: "GET /api/users/:id",
      fetch: (request) =>
        Response.json({ id: request.params.id, name: "John" }),
    },
    {
      endpoint: "POST /api/users",
      acceptedMediaTypes: ["application/json"],
      fetch: async (request) => {
        const user = await request.json();
        return Response.json(user, { status: 201 });
      },
    },
  ],
});
```

**Static file server**

```js
import { createFileSystemFetch, startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET *",
      fetch: createFileSystemFetch(import.meta.resolve("./public/"), {
        etagEnabled: true,
        compressionEnabled: true,
      }),
    },
  ],
});
```

**HTTPS server**

```js
import { readFileSync } from "node:fs";
import { startServer } from "@jsenv/server";

await startServer({
  https: {
    certificate: readFileSync(new URL("./server.crt", import.meta.url), "utf8"),
    privateKey: readFileSync(new URL("./server.key", import.meta.url), "utf8"),
  },
  routes: [
    {
      endpoint: "GET *",
      fetch: () => new Response("Welcome"),
    },
  ],
});
```

# Documentation

Every option is described by the JSDoc of the export (`startServer`, `createFileSystemFetch`, `serverPluginCORS`, …): hover it in your editor. The pages below explain how the pieces fit together.

| Topic                                                | Description                                            |
| ---------------------------------------------------- | ------------------------------------------------------ |
| [Handling requests](./docs/handling_requests.md)     | Routes, the request object, the response formats       |
| [Handling errors](./docs/handling_errors.md)         | What happens when a route throws, error pages          |
| [Plugins](./docs/plugins.md)                         | The hooks a server plugin can implement                |
| [Serving files](./docs/serving_files.md)             | Static files with client cache and compression         |
| [Content negotiation](./docs/content_negotiation.md) | Media type, language, version and encoding negotiation |
| [WebSocket](./docs/websocket.md)                     | Accepting WebSocket connections                        |
| [Server-Sent Events](./docs/server_sent_events.md)   | Pushing events to clients                              |
| [CORS](./docs/cors.md)                               | Cross-Origin Resource Sharing                          |
| [HTTPS](./docs/https.md)                             | HTTPS, http redirection and http2                      |
| [Server timing](./docs/server_timing.md)             | Reporting where the server spent its time              |
| [Lifecycle](./docs/lifecycle.md)                     | Starting, stopping, keeping the process alive          |
| [Security](./docs/security.md)                       | What the server protects, what it leaves to you        |
| [Cluster](./docs/cluster.md)                         | One server per CPU core                                |
