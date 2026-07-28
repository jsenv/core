---
name: server
description: How to use @jsenv/server — startServer, routing, request/response, websockets, and server-sent events. Use when working in packages/backend/server or building an HTTP server / route with @jsenv/server.
---

## Running from source

`@jsenv/server` resolves to its built `dist/` by default. When running anything that imports it from this repo, pass `--conditions=dev:jsenv` so imports hit `src/`/`index.js` instead of the stale bundle:

```sh
node --conditions=dev:jsenv <file>
```

## Public API

Exported from [index.js](../../../index.js):

- `startServer(options)` — start an HTTP/HTTPS/HTTP2 server.
- `WebSocketResponse` — return from a route `fetch` to accept a websocket upgrade.
- `ProgressiveResponse` — streaming/long-poll response (`{ write, end }`).
- `ServerEvents`, `LazyServerEvents` — SSE + websocket broadcast controllers.
- `fetchFileSystem`, `createFileSystemFetch`, `fetchDirectory` — serve files/directories from disk as a route `fetch`.
- `serverPluginCORS`, `serverPluginErrorHandler`, `serverPluginRequestAliases`, `serverPluginResponseAcceptanceCheck` — built-in server plugins.
- `pickContentType`, `pickContentEncoding`, `pickContentLanguage` — content negotiation helpers.
- `composeTwoResponses`, `findFreePort`, `STOP_REASON_*` — misc utilities.

## `startServer`

Defined in [src/start_server.js](../../../src/start_server.js). Returns `{ origin, origins, port, hostname, nodeServer, stop, stoppedPromise, addEffect, webSocketOrigin, getStatus }`.

Common options: `routes = []`, `plugins = []`, `port = 0` (0 → free port), `hostname = "localhost"`, `https = { certificate, privateKey }`, `http2`, `logLevel`, `keepProcessAlive`, `signal`. Unknown params throw. `canExposeSensitiveData` (default false) unlocks dev-only behavior (declaration-source links, open-file endpoint, all routes visible).

## Routing

A route descriptor (see [src/router/router.js](../../../src/router/router.js) `createRoute`):

```js
{
  endpoint: "GET /users/:id",        // "METHOD /pattern"; method may be * ; pattern via @jsenv/url-pattern
  fetch: (request, helpers) => response,
  description,                        // shown in the route inspector
  declarationSource: import.meta.url,
  availableMediaTypes,               // drives content negotiation + Vary (also auto-inferred from extension)
  headers,                           // header pattern that must match; headers.upgrade:"websocket" marks a WS route
}
```

Routes are tried in order; the first to return a non-nullish response wins. `endpoint` ending in `.websocket` also marks it as a websocket route.

**`fetch(request, helpers)`** — `helpers` includes `{ kitchen? , timing, injectResponseHeader(name, value), contentNegotiation, router, … }`.

**Return value** (resolved async if a promise):

- a `Response` instance, or
- a plain `{ status, statusText, headers, body }` object (`status` defaults to 404, `headers` to `{}`), or
- a `WebSocketResponse`, or
- `null` / `undefined` → decline, router tries the next route.

Anything else throws. When no route responds, the router synthesizes 404/405/406/415/426 from what would have matched.

## The `request` object

From [src/interfacing_with_node/from_node_request.js](../../../src/interfacing_with_node/from_node_request.js). Frozen; key props: `method`, `headers` (lowercased), `params` (pattern captures), `searchParams` (URLSearchParams), `pathname`, `resource` (path+search), `url`, `origin`, `cookies` (Map), `signal`, `body`. Body readers (async): `request.json()`, `request.text()`, `request.buffer()`, `request.formData()`, `request.queryString()`.

## Websockets — `WebSocketResponse`

```js
{
  endpoint: "GET /chat.websocket",
  fetch: () => new WebSocketResponse((websocket) => {
    // websocket is the raw `ws` socket
    websocket.on("message", (data) => websocket.send(data));
    return () => { /* runs on close */ };
  }),
}
```

The handler runs after the upgrade; if it returns a function, that's the cleanup callback.

## Server events — `ServerEvents` / `LazyServerEvents`

```js
const serverEvents = new ServerEvents({ actionOnClientLimitReached: "kick-oldest" });
// broadcast to every connected client (SSE or websocket)
serverEvents.sendEventToAllClients({ type: "reload", data: {...} });
// expose the endpoint
const route = {
  endpoint: "GET /events",
  fetch: (request) => serverEvents.fetch(request),
};
```

`serverEvents.fetch` inspects the request: a websocket upgrade returns a `WebSocketResponse` client; `Accept: text/event-stream` returns an SSE stream; else 400. Other methods: `getClientCount()`, `close()`, `open()`, `getAllEventSince(id)`. `LazyServerEvents(producer)` only opens the source on the first client connect and exposes just `{ fetch }`. Note: it broadcasts to all clients — there is no built-in per-client targeting.

## Serving files

`fetchFileSystem(url, { request, ... })` and `createFileSystemFetch(directoryUrl, options)` turn a filesystem read into a route response (content type, etag/mtime, range, compression). `fetchDirectory` produces a directory index. Use these instead of hand-rolling `readFileSync` in a route when you want proper caching/negotiation headers.
