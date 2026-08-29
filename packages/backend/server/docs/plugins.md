# Plugins

A server plugin is an object with a `name` and some of the hooks below. Plugins run in the order they are given, after the built-in ones. An array of plugins is flattened, so a function can return several plugins, or none (`serverPluginCORS` returns `[]` when CORS stays disabled).

```js
await startServer({
  plugins: [
    {
      name: "my_plugin",
      routes: [{ endpoint: "GET /health", fetch: () => new Response("ok") }],
      injectResponseProperties: () => {
        return { headers: { "x-powered-by": "jsenv" } };
      },
    },
  ],
});
```

## Hooks

In the order they run for a request:

| hook                         | signature                                                                       | role                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `serverListening`            | `({ port })`                                                                    | once, when the server listens                                                                                                |
| `redirectRequest`            | `(request) => { resource } \| { pathname } \| { ...requestProperties } \| null` | replace the request seen by the routes; `request.original` keeps the first one                                               |
| `augmentRouteFetchSecondArg` | `async (request, helpers) => { ...moreHelpers } \| null`                        | add helpers for the routes                                                                                                   |
| `grantPermissions`           | `async (request) => ["permission", …] \| null`                                  | called lazily, at most once per request, only when a route declares permissions                                              |
| `routes`                     | an array of route descriptors                                                   | appended after the routes given to `startServer`                                                                             |
| `handleError`                | `async (error, { request }) => response \| null`                                | answer a route that threw; the first response wins ([handling errors](./handling_errors.md))                                 |
| `inspectResponse`            | `(request, { response, warn })`                                                 | look at the response before it is sent (`response` is `{ status, statusText, headers, body }`), `warn` logs for that request |
| `injectResponseProperties`   | `(request, response) => responseToCompose \| null`                              | compose something into every response — headers mostly, see `composeTwoResponses`                                            |
| `serverStopped`              | `({ reason })`                                                                  | once, when the server stopped                                                                                                |

`redirectRequest` and `injectResponseProperties` are synchronous; `augmentRouteFetchSecondArg`, `grantPermissions` and `handleError` may return a promise.

Lifecycle properties: `init()` runs before the server starts (returning `false` disables the plugin, returning a function registers it as `destroy`), `destroy()` runs when the server stops, `effect({ otherPlugins })` runs after every `init` (returning nothing disables the plugin).

## Built-in plugins

Always on:

- response cookies — `helpers.responseCookies.set(name, value, options)` and `.delete(name)`,
- default body for 4xx/5xx — a response without body for such a status gets one from its `statusText`/`statusMessage`,
- route inspector — `GET /.internal/route_inspector` and `GET /.internal/routes.json`.

With `canExposeSensitiveData` (development only, see [security](./security.md)):

- open file — `GET /.internal/open_file/*` opens a file of the machine in the editor,
- internal client files — `GET /@jsenv/server/*` serves this package's client files,
- autoreload on restart — `GET /.internal/alive.websocket` and `GET /.internal/alive.eventsource` close when the server stops, so a client reloads.

Exported, to add yourself: `serverPluginCORS`, `serverPluginErrorHandler`, `serverPluginRequestAliases`, `serverPluginResponseAcceptanceCheck`. Their options are in their JSDoc.
