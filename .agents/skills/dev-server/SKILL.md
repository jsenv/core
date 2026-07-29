---
name: dev-server
description: How the jsenv dev server works — plugins, server events, internal pages/script injection, and running it from source. Use when modifying the dev server (src/dev, src/plugins, src/kitchen) or writing a plugin.
---

## Running from source (do this first)

The dev server lives in `src/` but `@jsenv/core` resolves to the built `dist/` bundle by default. Always launch node with the `dev:jsenv` export condition, or you run the **stale bundle** and your edits do nothing:

```sh
node --conditions=dev:jsenv <file>
```

For a throwaway check, import from `./src/main.js` and run from the repo root (so `@jsenv/core` and deps like `ws` resolve). Verify HTTP routes with `fetch`; the WebSocket transport may crash under some Node versions in a bare harness (bundled `ws`), so don't conclude a socket route is broken from that alone — check it in a real browser.

## `startDevServer`

Defined in [src/dev/start_dev_server.js](../../../src/dev/start_dev_server.js). Serves `sourceDirectoryUrl`, cooking each file through the plugin pipeline. Key options: `sourceDirectoryUrl` (required), `port`, `plugins`, `serverPlugins`, `clientAutoreload`, `ribbon`, `supervisor`, `directoryListing`. Returns `{ origin, sourceDirectoryUrl, stop, kitchenCache }` (note: `origin`, not `port`).

It always registers `jsenvPluginServerEvents` and `jsenvPluginClientMonitoring` first, then user `plugins`, then core plugins. Plugin collection happens in [src/plugins/jsenv_plugins_controller.js](../../../src/plugins/jsenv_plugins_controller.js).

## Plugin shape

A jsenv plugin is a plain object. Fields fall into **non-hooks** (passed through) and **hooks** (invoked by the controller) — see `JSENV_PLUGIN_DESCRIPTION` in the controller.

Non-hooks: `name`, `appliesDuring` (`"dev"` | `"build"` | `"*"` | `{dev,build}`), `serverRoutes`, `serverPlugins`, `serverEvents`, `mustStayFirst`.

Hooks (most-used): `redirectReference`, `resolveReference`, `transformUrlContent` (keyed by type, e.g. `{ html: (urlInfo) => … }`), `fetchUrlContent`, `finalizeUrlContent`, `effect({ kitchenContext, otherPlugins })`, `destroy`, plus build-only hooks (`bundle`, `optimizeBuildUrlContent`, …).

- `transformUrlContent.html` returns a string, or `{ content }` / `{ contentInjections }` (placeholder substitution). This is where scripts get injected into HTML (`injectJsenvScript`).
- `redirectReference(reference)` returns a URL string to point a reference at another graph URL. This is the mechanism to route a request at an internal HTML file (see below).
- `effect` runs once; use it to wire cross-plugin behavior. Server events are collected here.

### `serverRoutes`

Array of `@jsenv/server` route descriptors: `{ endpoint: "GET /.internal/x", description, declarationSource: import.meta.url, availableMediaTypes?, fetch: (request, { kitchen }) => response }`. `fetch` may return a `Response`, a `{ status, headers, body }` object, a `WebSocketResponse`, or `null`/`undefined` to decline. Registered before the catch-all `GET *`, so they match first. See the co-located `@jsenv/server` skill at [packages/backend/server/.agents/skills/server/SKILL.md](../../../packages/backend/server/.agents/skills/server/SKILL.md) for route/request/response details.

## Server events (server → clients, broadcast)

The reusable server→client channel. A plugin declares:

```js
serverEvents: {
  my_event: (serverEventInfo) => {
    // runs ONCE at setup; register listeners here, capture sendServerEvent
    someEmitter.on((data) => serverEventInfo.sendServerEvent(data));
  },
}
```

[jsenvPluginServerEvents](../../../src/plugins/server_events/jsenv_plugin_server_events.js) collects every plugin's `serverEvents` in its `effect`, builds one `ServerEvents` (from `@jsenv/server`), and exposes `sendServerEvent(data)` which **broadcasts** `{ type: eventName, data }` to all clients over the single `/.internal/events.websocket`. There is no per-client targeting and no inbound path — for client→server, use a plain HTTP route (POST). `serverEventInfo` also carries the whole `kitchenContext` (`kitchen`, `kitchen.graph`, `rootDirectoryUrl`, `signal`). Reference example: [jsenv_plugin_autoreload_server.js](../../../src/plugins/autoreload/jsenv_plugin_autoreload_server.js) (`reload`).

### Client side — `window.__server_events__`

Injected into every cooked HTML page by `jsenvPluginServerEvents.transformUrlContent.html`. API: `listenEvents({ [eventType]: (event) => { /* event.data */ } })`, plus `connect`/`disconnect`/`readyState`. It manages the websocket, reconnection, and pings for you — consumers just call `listenEvents`.

## Internal HTML pages & script injection (important)

Injection (`window.__server_events__`, ribbon, supervisor) only happens for HTML **cooked as a graph URL**. Two ways to serve internal HTML, with opposite behavior:

- **Raw `serverRoutes.fetch` returning `readFileSync(html)`** → returned verbatim, NOT cooked → **no injection**. Fine for JSON/websocket/opaque responses, not for pages that need the injected clients.
- **Redirect a reference to a real HTML file URL** → the file enters the graph, gets cooked by the catch-all `GET *`, runs all `transformUrlContent.html` hooks → **gets injection**. This is what the directory listing does ([jsenv_plugin_directory_listing.js](../../../src/plugins/protocol_file/jsenv_plugin_directory_listing.js)) and what the client-monitoring plugin does ([src/plugins/client_monitoring/jsenv_plugin_client_monitoring.js](../../../src/plugins/client_monitoring/jsenv_plugin_client_monitoring.js)).

Pattern (from the devices plugin):

```js
const pageFileUrl = new URL("./client/page.html", import.meta.url).href;
return {
  redirectReference: (reference) => {
    if (reference.isInline || !reference.url.startsWith("file:")) return null;
    const { pathname, search } = new URL(reference.url);
    if (pathname.endsWith("/.internal/my-page"))
      return `${pageFileUrl}${search}`;
    return null;
  },
  // do NOT also register a `GET /.internal/my-page` serverRoute — that raw route
  // would match first and bypass cooking. Let the catch-all cook the redirect.
};
```

The browser URL stays as requested (the redirect is internal). `?search` is carried through, so a page can read `location.search`. Inline `<script type="module">` in such a page is externalized/supervised exactly like any app page — that is expected, the code still runs.

If a `transformUrlContent.html` hook injects into every page (like the devices client), exclude your own internal pages by matching their file URL (`asUrlWithoutSearch(urlInfo.url) === pageFileUrl`), since after cooking their url is the template file url, not the `/.internal/...` request path.
