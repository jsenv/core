# CORS

Cross-origin requests are refused by browsers unless the response carries the access control headers. `serverPluginCORS` adds them to every response, including errors — a 500 without them shows up as a CORS failure in the browser, which hides the actual problem.

```js
import {
  serverPluginCORS,
  serverPluginErrorHandler,
  startServer,
} from "@jsenv/server";

await startServer({
  plugins: [
    serverPluginErrorHandler(),
    serverPluginCORS({
      accessControlAllowedOrigins: ["https://my-app.example"],
      accessControlAllowRequestMethod: true,
      accessControlAllowRequestHeaders: true,
      accessControlAllowCredentials: true,
    }),
  ],
});
```

The plugin stays off (returns no plugin) unless `accessControlAllowedOrigins` lists an origin or `accessControlAllowRequestOrigin` is true. The options are in its JSDoc; the ones worth a word:

- `accessControlAllowedOrigins` — the origins allowed to read the responses. `*` stands for any run of characters except `/`, so `"https://pr-*-my-app.fly.dev"` covers every preview deployment. The request origin is reflected back when it is allowed, with `vary: origin`.
- `accessControlAllowRequestOrigin` — reflect any origin. Fine for a public API, not with credentials.
- `accessControlAllowRequestMethod`, `accessControlAllowRequestHeaders` — also allow whatever a preflight asks for, on top of `accessControlAllowedMethods` (GET, POST, PUT, DELETE, OPTIONS) and `accessControlAllowedHeaders` (`x-requested-with`).
- `accessControlMaxAge` — seconds a browser may cache a preflight (600).

Preflight `OPTIONS` requests are answered by the router itself (see [handling requests](./handling_requests.md)); the plugin only adds the headers.
