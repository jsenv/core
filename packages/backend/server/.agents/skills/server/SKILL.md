---
name: server
description: How to use @jsenv/server — startServer, routing, request/response, websockets, and server-sent events. Use when working in packages/backend/server or building an HTTP server / route with @jsenv/server.
---

## Running from source

`@jsenv/server` resolves to its built `dist/` by default. When running anything that imports it from this repo, pass `--conditions=dev:jsenv` so imports hit `src/`/`index.js` instead of the stale bundle:

```sh
node --conditions=dev:jsenv <file>
```

## Where the knowledge is

- [docs/AI_INSTRUCTIONS.md](../../../docs/AI_INSTRUCTIONS.md) lists the guideline docs (one per area) and the traps.
- The JSDoc of each export is the reference for its options: [src/start_server.js](../../../src/start_server.js) for `startServer` and the shape of a route, [src/plugins/filesystem/fetch_file.js](../../../src/plugins/filesystem/fetch_file.js) for `createFileSystemFetch`, and so on. When an option changes, its JSDoc is what must change; the docs describe mechanisms, never option lists.
- [src/plugins/server_plugins_controller.js](../../../src/plugins/server_plugins_controller.js) lists the plugin hooks; [docs/plugins.md](../../../docs/plugins.md) explains them.

## Public API

Exported from [index.js](../../../index.js):

- `startServer(options)` — start an http/https (optionally http2) server. Returns `{ origin, origins, port, hostname, nodeServer, webSocketOrigin, stop, stoppedPromise, getStatus, addEffect }`.
- `WebSocketResponse` — return from a route `fetch` to accept a websocket upgrade.
- `ProgressiveResponse` — streaming/long-poll response (`{ write, end }`).
- `ServerEvents`, `LazyServerEvents` — SSE + websocket broadcast controllers.
- `fetchFileSystem`, `createFileSystemFetch`, `fetchDirectory` — serve files/directories from disk as a route `fetch`.
- `serverPluginCORS`, `serverPluginErrorHandler`, `serverPluginRequestAliases`, `serverPluginResponseAcceptanceCheck` — built-in server plugins.
- `pickContentType`, `pickContentEncoding`, `pickContentLanguage` — content negotiation helpers.
- `composeTwoResponses`, `findFreePort`, `STOP_REASON_*` — misc utilities.
- `createPluginsController` — the generic plugin controller, shared with @jsenv/core.

## Routing

A route descriptor (see `createRoute` in [src/router/router.js](../../../src/router/router.js)):

```js
{
  endpoint: "GET /users/:id",        // "METHOD /pattern"; method may be * ; pattern via @jsenv/url-pattern
  fetch: (request, helpers) => response,
  description,                        // shown in the route inspector
  declarationSource: import.meta.url,
  availableMediaTypes,               // drives content negotiation + Vary (also auto-inferred from extension)
  headers,                           // header pattern that must match; headers.upgrade:"websocket" marks a WS route
  permissionsRequired, permissionsToSee, // see docs/handling_requests.md
}
```

Routes are tried in order; the first to return a non-nullish response wins. `endpoint` ending in `.websocket` also marks it as a websocket route.

**`fetch(request, helpers)`** — `helpers` is `{ timing, injectResponseHeader, contentNegotiation, responseCookies, hasPermissions, getAllPermissions, router, canExposeSensitiveData }` plus what plugins add through `augmentRouteFetchSecondArg` (the jsenv dev server adds `kitchen`).

**Return value** (resolved async if a promise):

- a `Response` instance, or
- a plain `{ status, statusText, statusMessage, headers, body }` object (`status` defaults to 404, `headers` to `{}`), or
- a `WebSocketResponse`, or
- `null` / `undefined` → decline, router tries the next route.

Anything else throws. When no route responds, the router synthesizes 404/405/406/415/426 from what would have matched.

## The `request` object

From [src/interfacing_with_node/from_node_request.js](../../../src/interfacing_with_node/from_node_request.js). Frozen; key props: `method`, `headers` (lowercased), `params` (pattern captures), `searchParams` (URLSearchParams), `pathname`, `resource` (path+search), `url`, `origin`, `cookies` (Map), `signal`, `body`, `ip`/`ipForwarded`. Body readers (async): `request.json()`, `request.text()`, `request.buffer()`, `request.formData()`, `request.queryString()`.

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

`fetchFileSystem(request, helpers, directoryUrl, options)` and `createFileSystemFetch(directoryUrl, options)` turn a filesystem read into a route response (content type, etag/mtime, compression, directory listing). Use these instead of hand-rolling `readFileSync` in a route when you want proper caching/negotiation headers. File paths show up in status texts only under `canExposeSensitiveData`.

## http2

Never removed, off by default. Measured (Chromium, 300 modules): no gain on localhost, 3 to 10 times faster once there is network latency (a phone on the wifi). Http2 has no reason phrase, so `statusText` only reaches the logs and the 4xx/5xx bodies. Details and numbers in [docs/https.md](../../../docs/https.md).
