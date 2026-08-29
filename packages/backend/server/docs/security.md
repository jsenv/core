# Security

What the server takes care of, and what it leaves to the code around it.

## What it does

- A malformed header (`forwarded`, `cookie`, `referer`, `accept`…) never takes the server down: a request that cannot be read is answered 500 and logged.
- What a response echoes from the request (the url in a 404 message, a file path in a status text) is escaped in the html error pages, and status texts are reduced to what a status line accepts.
- `createFileSystemFetch` refuses to leave its directory (403).
- A route declaring permissions hides every route that declares none: forgetting `permissionsRequired` cannot expose a route ([handling requests](./handling_requests.md)).
- Once one route has permissions, the route inspector only lists what the requester may see.

## `canExposeSensitiveData`

This option lets the server hand out what belongs to the machine it runs on. It is meant for the developer's machine, never for a server others can reach. It unlocks:

- file paths in status texts (a 404 from `createFileSystemFetch` says which path);
- the declaration source of every route in the route inspector, where every route is listed whatever its permissions;
- `GET /.internal/open_file/*`, which opens any file of the machine in the editor;
- `GET /@jsenv/server/*`, which serves this package's own files;
- `/.internal/alive.websocket` and `/.internal/alive.eventsource`, telling clients when the server restarts.

`sendErrorDetails` of `serverPluginErrorHandler` is of the same kind: a stack reveals file paths and code.

## What it leaves to you

- **The `host` header is not checked.** Any name pointing at the machine reaches the server: a site can rebind its DNS to `127.0.0.1` and, from the browser of a developer running a server with `canExposeSensitiveData`, read what it serves and open files in the editor. Bind to `localhost` (the default) rather than `acceptAnyIp`, and put a reverse proxy in front for anything public.
- **Forwarded headers are trusted as-is.** `request.ipForwarded`, `protoForwarded` and `hostForwarded` are what the `forwarded` / `x-forwarded-*` headers say; any client can send them. Read them only behind a proxy you control, `request.ip` is the socket address.
- **Request bodies have no size limit.** `request.json()`, `text()`, `buffer()` read everything; `formData()` writes uploaded files to the temp directory and does not delete them. For untrusted clients, read `request.body` (an observable of chunks) and stop past your limit, or check `content-length` first.
- **A route that throws with no error handler exits the process.** Always run with `serverPluginErrorHandler` (or a `handleError` plugin), see [handling errors](./handling_errors.md).
- **No rate limiting, no authentication.** `grantPermissions` is where a session or a token becomes permissions; what it checks is up to you.
