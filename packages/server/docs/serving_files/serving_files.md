# Serving files

A server often needs to serve file without routing logic. Either the file is there and server sends it, or it responds with a 404 status code. You can use _fetchFileSystem_ for that, an async function that will search for a file on the filesystem and produce a response for it.

```js
import { startServer, fetchFileSystem } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: (request) => {
        return fetchFileSystem(
          new URL(request.ressource.slice(1), import.meta.url),
          {
            headers: request.headers,
          },
        )
      },
    },
  ],
})
```

When request.method is not `"HEAD"` or `"GET"` the returned response correspond to _501 not implemented_.

_fetchFileSystem_ can be configured to handle cache, compression and content types.

## Configuring file response cache

When server receives a request it can decides to respond with _304 Not modified_ instead of _200 OK_.
A 304 status tells the client it can use its cached version of the response.
Consequently 304 responses have an empty body while 200 contains the file content.

By default _fetchFileSystem_ will always respond with 200. You can unlock 304 responses using either _etag_ or _mtime_ based caching.

### etagEnabled

```js
import { startServer, fetchFileSystem } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: (request) => {
        return fetchFileSystem(
          new URL(request.ressource.slice(1), import.meta.url),
          {
            headers: request.headers,
            etagEnabled: true,
          },
        )
      },
    },
  ],
})
```

When _etagEnabled_ is true, _fetchFileSystem_ will try to return 304 when request headers contains _if-none-match_.
When etag generated from the file content equals the one found in request headers, a 304 response without body is sent, otherwise it will be a 200 with the file content in the body.

### mtimeEnabled

```js
import { startServer, fetchFileSystem } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: (request) => {
        return fetchFileSystem(
          new URL(request.ressource.slice(1), import.meta.url),
          {
            headers: request.headers,
            mtimeEnabled: true,
          },
        )
      },
    },
  ],
})
```

When mtimeEnabled is true, _fetchFileSystem_ will to return 304 when request headers contains _if-modified-since_.
When filesystem modification date equals the one found in request headers, a 304 response without body is sent, otherwise it will be a 200 with the file content in the body.

Things to know:

- _mtime_ is less robust then _etag_ because it assumes filesystem dates are reliable.
- Date comparison is precise to the millisecond.

### cacheControl

```js
import { startServer, fetchFileSystem } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: (request) => {
        return fetchFileSystem(
          new URL(request.ressource.slice(1), import.meta.url),
          {
            headers: request.headers,
            cacheControl:
              request.ressource === "/"
                ? `private,max-age=0,must-revalidate`
                : `private,max-age=3600,immutable`,
          },
        )
      },
    },
  ],
})
```

_cacheControl_ parameter will become the response _cache-control_ header.
Read more about this header at https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control.
During development, you likely don't want to enable _cache-control_ header.

## Configuring file response compression

When compression is enabled _fetchFileSystem_ uses a compression format if possible.
Internally it uses content encoding negotiation (see [Content negotiation](../content_negotiation/content_negotiation.md#content-negotiation)).
The available compression formats are _gzip_, _brotli_ and _deflate_. One (or none) is picked according to the _accept-encoding_ request header.
To enable compression, use _compressionEnabled_ and _compressionSizeThreshold_ parameter.

```js
import { startServer, fetchFileSystem } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: (request) => {
        return fetchFileSystem(
          new URL(request.ressource.slice(1), import.meta.url),
          {
            headers: request.headers,
            compressionEnabled: true,
            compressionSizeThreshold: 1024,
          },
        )
      },
    },
  ],
})
```
