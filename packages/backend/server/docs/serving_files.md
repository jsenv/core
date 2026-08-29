# Serving files

```js
import { createFileSystemFetch, startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /assets/*",
      fetch: createFileSystemFetch(import.meta.resolve("./assets/")),
    },
    {
      endpoint: "GET *",
      fetch: createFileSystemFetch(import.meta.resolve("./public/"), {
        mainFileRelativeUrl: "./index.html",
      }),
    },
  ],
});
```

The part of the url captured by `*` (the whole resource when the endpoint has none) is resolved inside the directory. A url leaving the directory (`..`) is answered 403. Any method other than GET and HEAD is declined: the next route is tried. The `content-type` comes from the file extension.

The options are in the JSDoc of `createFileSystemFetch`; what follows is how they combine.

## Client cache

By default every request gets 200 with the content. Two ways to unlock 304:

- `etagEnabled` — an `etag` computed from the content, remembered per file until its stats change (`etagMemory`, `etagMemoryMaxSize`); a matching `if-none-match` gets 304. Robust.
- `mtimeEnabled` — a `last-modified` header from the filesystem date, second precision; a recent enough `if-modified-since` gets 304. Relies on filesystem dates being meaningful.

When both are set, etag wins.

`cacheControl` becomes the `cache-control` header. By default a versioned url (`isVersioned`: the url has a `v` search param) is `private,max-age=2592000,immutable` and anything else `private,max-age=0,must-revalidate`. It can be a function of the request:

```js
createFileSystemFetch(import.meta.resolve("./"), {
  etagEnabled: true,
  cacheControl: (request) =>
    request.resource === "/"
      ? `private,max-age=0,must-revalidate`
      : `private,max-age=3600,immutable`,
});
```

`"no-store"` disables etag and mtime, they would be pointless.

## Compression

`compressionEnabled` compresses textual files bigger than `compressionSizeThreshold` (1024 bytes) with brotli, gzip or deflate, whichever `accept-encoding` prefers. The compression happens for every request (brotli at quality 4 to keep it cheap) and the response has no `content-length`: for production, compress the files once at build time instead.

## Directories

A url pointing to a directory gets 403, unless:

- `canReadDirectory: true` — the listing is sent, as json or as an html page of links (see `fetchDirectory`),
- `mainFileRelativeUrl` — that file is sent for the directory itself, and for any extension-less url that does not exist (client side routing needs the same page for `/users/42`).

`ENOENTFallback: () => fileUrl` serves another file when the requested one does not exist.

## What a 404 says

The status text is `ENOENT: File not found`; the file path is added only when the server runs with `canExposeSensitiveData` (see [security](./security.md)). Same for the other filesystem errors (EACCES → 403, EBUSY → 503 with `retry-after`, …).
