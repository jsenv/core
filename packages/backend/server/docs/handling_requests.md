# Handling requests

A request is answered by the first route whose `fetch` returns a response.

```js
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /",
      fetch: () => new Response("Hello world"),
    },
  ],
});
```

## Routes

`endpoint` is an http method (or `*`) followed by a resource pattern:

| endpoint               | matches                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `GET /`                | exactly `/`                                                         |
| `GET /users/:id`       | `/users/42`, with `request.params.id === "42"`                      |
| `GET /assets/*`        | `/assets/css/main.css`, with `request.params[0] === "css/main.css"` |
| `GET /search?q=:query` | `/search?q=hello`, with `request.params.query === "hello"`          |
| `* /api/*`             | any method                                                          |
| `GET *`                | anything: a catch-all, put it last                                  |

Routes are tried in order. `fetch` can be async; returning `null` or `undefined` declines the request and the next route is tried.

When no route answers, the router builds the response from what almost matched:

- **405 Method Not Allowed** (with an `allow` header) when the resource matched routes for other methods,
- **415 Unsupported Media Type** when a POST/PATCH/PUT route wanted another `content-type` (see `acceptedMediaTypes` below),
- **406 Not Acceptable** when the route cannot produce what the request accepts (see [content negotiation](./content_negotiation.md)),
- **426 Upgrade Required** for a websocket route requested without an upgrade,
- **404 Not Found** otherwise.

`OPTIONS` requests are answered from the routes (`allow`, `accept-post`, `accept-patch` headers); `OPTIONS *` describes the whole server.

The routes can be explored at `/.internal/route_inspector` (json at `/.internal/routes.json`); a route's `description` and `clientCodeExample` show up there.

## The request object

Frozen, passed as first argument to `fetch`:

```js
request.method; // "GET"
request.url; // "http://127.0.0.1:8080/users/42?page=2"
request.origin; // "http://127.0.0.1:8080"
request.pathname; // "/users/42"
request.resource; // "/users/42?page=2" (path and search, as received)
request.searchParams; // URLSearchParams
request.params; // { id: "42" }, captured by the endpoint pattern
request.headers; // { accept: "text/html", ... } lowercased names
request.cookies; // Map { "session" => "abc" }
request.signal; // AbortSignal: the client left, or the server stops
request.http2; // true when the request came over http2
request.ip; // address of the socket
request.ipForwarded; // what the forwarded / x-forwarded-for header says, unverified
request.protoForwarded; // idem (x-forwarded-proto)
request.hostForwarded; // idem (x-forwarded-host)
```

Reading the body, each returns a promise:

- `request.json()`, `request.text()`, `request.buffer()`
- `request.formData()` → `{ fields, files }` for `multipart/form-data` (files are written to the temp directory)
- `request.queryString()` for `application/x-www-form-urlencoded`
- `request.body` is an observable of chunks, for streaming or for reading with a size limit

Nothing limits the size of what `json()`, `text()` and `buffer()` read: read `request.body` yourself when the client is not trusted (see [security](./security.md)).

A route reading its body declares `acceptedMediaTypes`: an unsupported `content-type` is refused with 415 before `fetch` runs.

```js
{
  endpoint: "PATCH /users/:id",
  acceptedMediaTypes: ["application/json", "multipart/form-data"],
  fetch: async (request) => {
    if (request.headers["content-type"] === "application/json") {
      const patch = await request.json();
      return Response.json(patch);
    }
    const { fields, files } = await request.formData();
    return Response.json({ fields, files: Object.keys(files) });
  },
}
```

## The helpers

Second argument of `fetch`:

```js
fetch: (request, helpers) => {
  helpers.timing; // measure something, see server_timing.md
  helpers.injectResponseHeader("vary", "accept"); // added to the response, whatever it ends up being
  helpers.contentNegotiation; // { mediaType, language, version, encoding }, see content_negotiation.md
  helpers.responseCookies.set("session", "abc", { httpOnly: true, path: "/" });
  helpers.responseCookies.delete("session");
  helpers.hasPermissions(["admin"]); // see permissions below
  helpers.getAllPermissions();
  helpers.canExposeSensitiveData; // the startServer option
  helpers.router; // router.inspect() lists the routes
};
```

Plugins add their own with `augmentRouteFetchSecondArg` (see [plugins](./plugins.md)).

## Responses

`fetch` returns a standard `Response`:

```js
new Response("Hello", {
  status: 200,
  headers: { "content-type": "text/plain" },
});
Response.json({ hello: "world" });
```

or a plain object:

```js
{
  status: 200, // defaults to 404
  statusText: "OK", // the reason phrase of the status line (http/1.1 only)
  statusMessage: "A longer explanation", // becomes the body of a 4xx/5xx response that has none
  headers: { "content-type": "text/plain" },
  body: "Hello",
}
```

`body` can be a string, a `Buffer`, a Node readable stream (`createReadStream(file)`), a web `ReadableStream`, a file handle, a promise of one of these, or be written over time:

```js
import { ProgressiveResponse } from "@jsenv/server";

fetch: () =>
  new ProgressiveResponse(({ write, end }) => {
    write("a");
    setTimeout(() => {
      write("b");
      end();
    }, 100);
  });
```

A 4xx/5xx response without body gets one — html, text or json depending on what the request accepts — made of `statusText` and `statusMessage`. What they say is escaped, so echoing the request in them is fine.

## Permissions

A plugin grants permissions to a request with the `grantPermissions` hook; each route declares what it needs:

```js
await startServer({
  plugins: [
    {
      grantPermissions: async (request) => {
        return (await isAdmin(request)) ? ["admin"] : [];
      },
    },
  ],
  routes: [
    // 404 for anyone else: the route does not even exist for them
    { endpoint: "GET /admin", permissionsRequired: ["admin"], fetch },
    // 403 for anyone else: the route is known, access is denied
    {
      endpoint: "DELETE /users/:id",
      permissionsRequired: ["admin"],
      permissionsToSee: [],
      fetch,
    },
    // everyone
    { endpoint: "GET /", permissionsRequired: [], fetch },
  ],
});
```

As soon as one route declares permissions, a route without `permissionsRequired` is hidden (404) from everyone: forgetting it cannot expose a route. `permissionsToSee` decides between 404 (hidden) and 403 (known, denied). Permissions are computed lazily and at most once per request, whatever the number of routes checked.

## Rewriting a request before routing

The `redirectRequest` plugin hook replaces the request seen by the routes; the first one stays reachable as `request.original`. `serverPluginRequestAliases` does it from url patterns:

```js
import { serverPluginRequestAliases } from "@jsenv/server";

plugins: [
  serverPluginRequestAliases({ "/": "/index.html", "/*.mjs": "/*.js" }),
];
```
