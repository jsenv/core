# Security

What the server takes care of, and what it leaves to the code around it.

## What it does

- A malformed header (`forwarded`, `cookie`, `referer`, `accept`…) never takes the server down: a request that cannot be read is answered 500 and logged.
- **The `host` header is checked.** A request whose host is not one of the names the server is reached at (localhost, `hostname`, the machine name and ips, `allowedHosts`) is answered 403. Without this a page served by another site reads the responses once its DNS name is rebound to this machine — the request comes from the developer's own browser, so listening on localhost is no protection. A custom name (an `/etc/hosts` entry, a tunnel) goes in `hostname` or `allowedHosts`; `allowedHosts: true` disables the check.
- **Request bodies are bounded.** `request.json()`, `text()`, `buffer()` and `queryString()` answer 413 past `requestBodyMaxSize` (1 MiB by default), from the `content-length` when there is one, else while reading; the rest of the body is drained for a few seconds so that the client gets the 413, then the connection is cut. A route accepting more passes its own `{ maxSize }`. `request.body` (the observable) is never limited: who streams it takes the responsibility. `formData()` is bounded by formidable (200 MB per file, 20 MB of fields).
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

- **Forwarded headers are trusted as-is.** `request.ipForwarded`, `protoForwarded` and `hostForwarded` are what the `forwarded` / `x-forwarded-*` headers say; any client can send them. Read them only behind a proxy you control, `request.ip` is the socket address.
- **Uploaded files are not cleaned up.** `formData()` writes them to the temp directory and leaves them there.
- **A route that throws with no error handler exits the process.** Always run with `serverPluginErrorHandler` (or a `handleError` plugin), see [handling errors](./handling_errors.md).
- **No rate limiting, no authentication.** `grantPermissions` is where a session or a token becomes permissions; what it checks is up to you.
