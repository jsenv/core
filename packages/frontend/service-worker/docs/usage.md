# @jsenv/service-worker usage

## The service worker file

`jsenv_service_worker.js` is a classic worker script: load it with
`importScripts`, then call `self.__sw__.init()`:

```js
// sw.js
self.importScripts("@jsenv/service-worker");

self.__sw__.init({
  name: "my-app",
  resources: {
    "/": {},
    // injected by jsenv build; undefined when the page runs unbuilt
    ...(self.resourcesFromJsenvBuild || {}),
  },
});
```

The bare specifier is resolved by jsenv (dev server and build). Outside jsenv,
point at the file — the path is relative to the worker file's own url:

```js
self.importScripts(
  "./node_modules/@jsenv/service-worker/src/jsenv_service_worker.js",
);
```

`resources` lists what gets cached during "install" and served from cache in
"fetch". Values are `{}` for unversioned urls — refetched from the network
(bypassing the HTTP cache) at every install — or `{ version, versionedUrl }`
for build outputs. Requests not listed in `resources` are untouched and
handled by the browser as usual.

`"/": {}` is listed by hand because the build lists the entry as
`/main.html`, while a page reached at the origin root is a request for `/`.

## Registering from the page

Plain registration works:

```js
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
```

For update UI (check / activate / hot replacement), pair it with
[@jsenv/pwa](https://github.com/jsenv/core/tree/main/packages/frontend/pwa):

```js
import { createServiceWorkerFacade } from "@jsenv/pwa";

const swFacade = createServiceWorkerFacade();
swFacade.setRegistrationPromise(navigator.serviceWorker.register("./sw.js"));
```

`@jsenv/service-worker` implements the message protocol `@jsenv/pwa` relies
on, so `state.meta`, `checkForUpdates()`, `activateUpdate()` and resource
hot-replacement all work out of the box.

## Build integration

When the page is built with `@jsenv/core`, the build finds the worker through
the `navigator.serviceWorker.register(...)` call and treats it as an entry
point of its own:

- what it loads with `importScripts` is copied to the build and versioned
  (`self.importScripts(__v__("/js/jsenv_service_worker.js"))`); the worker
  file itself keeps its url, since the browser refetches it to notice an
  update;
- this is prepended to it:

```js
self.resourcesFromJsenvBuild = {
  "/main.html": { version: "e3b0c442" },
  "/css/style.css": {
    version: "0e312d1c",
    versionedUrl: "/css/style.css?v=0e312d1c",
  },
  // ...every file of the build, except the worker itself
};
```

Spreading it into `resources` (as in the file above) is all the integration
needed: versioned urls are served from cache and, being immutable, can come
from the HTTP cache at the next install instead of being downloaded again;
unversioned urls (like `/main.html`) get a computed `version` so the
worker script changes — and the browser detects an update — whenever their
content changes. This relies on the build's versioning being on (the default).

A value the worker needs at build time goes through the build's `injections`
(and the same option on `startDevServer` for dev):

```js
// build.mjs
await build({
  sourceDirectoryUrl: import.meta.resolve("../src/"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: { "./main.html": "main.html" },
  injections: {
    "./sw.js": () => ({ __APP_NAME__: "my-app" }),
  },
});

// sw.js
self.__sw__.init({
  name: __APP_NAME__,
  // ...
});
```

Resources from other origins are not part of the build; add them manually:

```js
self.__sw__.init({
  name: "my-app",
  resources: {
    "/": {},
    ...(self.resourcesFromJsenvBuild || {}),
    "https://fonts.googleapis.com/css2?family=Roboto": {},
  },
});
```

## Update flow

1. The browser finds a byte-different `sw.js` (on navigation, every 24h, or
   via `swFacade.checkForUpdates()`).
2. The new worker installs: it fills its own cache (name derived from `name` +
   a hash of `version` + `resources`) while the old worker keeps serving.
3. The new worker activates — after all tabs close, or immediately via
   `swFacade.activateUpdate()` — and deletes the previous caches.
4. Tabs then reload, unless `@jsenv/pwa` can hot-replace every changed
   resource: same `version`, and a `defineResourceUpdateHandler` for each
   changed url.

Bump `version` when a new worker must not be hot-updated (forces a reload).

## Custom actions

Handlers callable from the page:

```js
// sw.js
self.__sw__.init({
  name: "my-app",
  actions: {
    ping: (payload) => `pong ${payload}`,
  },
});

// page
const result = await swFacade.sendMessage({ action: "ping", payload: "!" });
console.log(result); // "pong !"
```

Built-in actions besides the lifecycle ones: `inspect`, returning
`{ name, version, resources, ...meta }`, and three to manage the current
worker's cache at runtime (the next worker version starts again from
`resources`):

```js
await swFacade.sendMessage({ action: "addCacheKey", payload: "/data.json" });
await swFacade.sendMessage({
  action: "refreshCacheKey",
  payload: "/data.json",
});
await swFacade.sendMessage({ action: "removeCacheKey", payload: "/data.json" });
```

`install`/`activate` options let the service worker run extra work during
those lifecycle events (returned promises are awaited).

## Debugging

```js
self.__sw__.init({
  logLevel: "debug", // "debug" | "info" | "warn" | "error"
});
```
