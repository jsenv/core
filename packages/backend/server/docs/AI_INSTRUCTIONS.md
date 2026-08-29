# @jsenv/server for AI agents

An http server for Node.js: `startServer({ routes, plugins })` where a route is `{ endpoint: "GET /users/:id", fetch: (request, helpers) => response }`.

## What to read, in order

1. The JSDoc of the export you use — `startServer` documents every option and the shape of a route; `createFileSystemFetch`, `serverPluginCORS`, `serverPluginErrorHandler`, `ServerEvents`, `WebSocketResponse`, `ProgressiveResponse`, `pickContentType`… document theirs. In a project the source with its JSDoc is `node_modules/@jsenv/server/dist/jsenv_server.js`.
2. The guideline docs of this directory, one per area:
   - [handling_requests.md](./handling_requests.md) — routes, the `request` object, `helpers`, response formats, what the router answers by itself
   - [handling_errors.md](./handling_errors.md) — a route that throws, `serverPluginErrorHandler`, timeouts
   - [plugins.md](./plugins.md) — the hooks, the built-in plugins
   - [serving_files.md](./serving_files.md) — `createFileSystemFetch`
   - [content_negotiation.md](./content_negotiation.md) — `availableMediaTypes` & co
   - [websocket.md](./websocket.md), [server_sent_events.md](./server_sent_events.md) — real time
   - [cors.md](./cors.md), [https.md](./https.md), [server_timing.md](./server_timing.md), [lifecycle.md](./lifecycle.md), [security.md](./security.md), [cluster.md](./cluster.md)
3. The tests in `tests/` of the package (only in the jsenv/core repository): one directory per feature, each test starts a real server and requests it.

## Things that are easy to get wrong

- A route responds with its `fetch` function (not `response`, not `handleRequest`). Returning `null`/`undefined` lets the next route try.
- The request `headers` object has lowercased keys; `request.cookies` is a `Map`; `request.params` holds what `:name` and `*` captured.
- A plain response object must give `status` (it defaults to 404). `statusMessage` is not `statusText`: it feeds the body of 4xx/5xx responses.
- Without a plugin implementing `handleError` (`serverPluginErrorHandler`), a route that throws makes the process exit.
- `canExposeSensitiveData: true` is for development on the developer's machine only (see [security.md](./security.md)).
- A request whose `host` header is not a name of the server gets 403: a custom hostname goes in `hostname` or `allowedHosts`.
- `request.json()` and the other readers answer 413 past 1 MiB (`requestBodyMaxSize`, or `{ maxSize }` per call).
- Running from the jsenv/core repository: `node --conditions=dev:jsenv <file>`, otherwise the stale `dist/` bundle is used.
