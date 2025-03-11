# server [![npm package](https://img.shields.io/npm/v/@jsenv/server.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/server)

> A modern, flexible Node.js HTTP server with declarative routing, content negotiation, and WebSocket support.

`@jsenv/server` simplifies server development with a declarative API that handles common web server needs like routing, content negotiation, file serving, and real-time communication.

```js
import { startServer } from "@jsenv/server";

await startServer({
  port: 8080,
  routes: [
    {
      endpoint: "GET *",
      response: () => new Response("Hello world"),
    },
  ],
});
```

# Features

- [*] Declarative routing with path parameters and pattern matching
- [*] Content negotiation for type, language, version and encoding
- [*] Real-time communication via WebSockets and Server-Sent Events
- [*] File serving with ETags, conditional requests, and compression
- [*] Security with HTTPS and automatic HTTP-to-HTTPS redirection
- [*] HTTP/2 support including server push
- [*] CORS handling built-in
- [*] Performance monitoring with server timing
- [*] Sacalability through cluster mode for multi-core utilization
- [ ] Request authentification with JWT, OAuth etc

# Installation

```console
npm install @jsenv/server
```

**Requirements:**

- Node.js 22.13.1 or higher
- ES modules support

# Quick Examples

**Basic API Server**

```js
import { startServer } from "@jsenv/server";

await startServer({
  port: 3000,
  routes: [
    {
      endpoint: "GET /api/users",
      response: () => Response.json([{ id: 1, name: "John" }]),
    },
    {
      endpoint: "GET /api/users/:id",
      response: (request) =>
        Response.json({ id: request.params.id, name: "John" }),
    },
    {
      endpoint: "GET *",
      response: () => new Response("Not found", { status: 404 }),
    },
  ],
});
```

**Static File Server**

```js
import { startServer, createFileSystemFetch } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET *",
      response: createFileSystemFetch(import.meta.resolve("./")),
    },
  ],
});
```

**HTTPS Server**

```js
import { readFileSync } from "node:fs";
import { startServer } from "@jsenv/server";

await startServer({
  https: {
    certificate: readFileSync(new URL("./server.crt", import.meta.url), "utf8"),
    privateKey: readFileSync(new URL("./server.key", import.meta.url), "utf8"),
  },
  allowHttpRequestOnHttps: true, // will disable https redirection and let you handle http request
  routes: [
    {
      endpoint: "GET *",
      response: (request) => {
        const clientUsesHttp = request.origin.startsWith("http:");
        return new Response(
          clientUsesHttp ? `Welcome http user` : `Welcome https user`,
        );
      },
    },
  ],
});
```

# Documentation

| Topic                                                | Description                                      |
| ---------------------------------------------------- | ------------------------------------------------ |
| [Handling requests](./docs/handling_requests.md)     | Process HTTP requests and generate responses     |
| [Handling errors](./docs/handling_errors.md)         | Error handling strategies and custom responses   |
| [Server timing](./docs/server_timing.md)             | Measure and report server performance metrics    |
| [CORS](./docs/cors.md)                               | Configure Cross-Origin Resource Sharing          |
| [HTTPS](./docs/https.md)                             | Set up secure HTTPS connections                  |
| [Serving files](./docs/serving_files.md)             | Static file serving with caching and compression |
| [Content negotiation](./docs/content_negotiation.md) | Content type, language and encoding negotiation  |
| [Websocket](./docs/websocket.md)                     | Bi-directional real-time communication           |
| [Server Sent Events](./docs/server_sent_events.md)   | Push updates to clients over HTTP                |
| [Cluster](./docs/cluster.md)                         | Scale your server across multiple CPU cores      |
| [HTTP/2 Push](./docs/http2_push.md)                  | Optimize loading with server push                |
