# @jsenv/service-worker usage

## The service worker file

`jsenv_service_worker.js` is a classic worker script: load it with
`importScripts`, then call `self.__sw__.init()`:

```js
// sw.js
self.importScripts(
  "./node_modules/@jsenv/service-worker/src/jsenv_service_worker.js",
);

self.__sw__.init({
  name: "my-app",
  resources: {
    "/": {},
    // injected by jsenv build; {} when the page runs unbuilt
    ...(self.resourcesFromJsenvBuild || {}),
  },
});
```

`resources` lists what gets cached during "install" and served from cache in
"fetch". Values are `{}` for unversioned urls — refetched from the network
(bypassing http cache) on every install — or `{ version, versionedUrl }` for
immutable build outputs. Requests not listed in `resources` are untouched and
handled by the browser as usual.

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

When building with `@jsenv/core`, the build finds the service worker through
the `navigator.serviceWorker.register(...)` call, bundles it, and prepends:

```js
self.resourcesFromJsenvBuild = {
  "/main.html": { version: "e3b0c442" },
  "/css/style.css": {
    version: "0e312d1c",
    versionedUrl: "/css/style.css?v=0e312d1c",
  },
  // ...every resource of the build
};
```

Spreading it into `resources` (as in the file above) is all the integration
needed: versioned urls are cached once and reused across updates, unversioned
urls (like `/main.html`) get a computed `version` so the service worker script
changes — and the browser detects an update — whenever their content changes.

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
   resource (same `version`, update handlers defined page-side).

Bump `version` when a new worker must not be hot-updated (forces a reload).

## Custom actions

Handlers callable from the page:

```js
// sw.js
self.__sw__.init({
  name: "my-app",
  actions: {
    ping: () => "pong",
  },
});

// page
const result = await swFacade.sendMessage({ action: "ping" });
console.log(result); // "pong"
```

Built-in actions besides the lifecycle ones: `refreshCacheKey(url)`,
`addCacheKey(url)`, `removeCacheKey(url)` to manage cached urls at runtime,
and `inspect` returning `{ name, version, resources, ...meta }`.

`install`/`activate` options let the service worker run extra work during
those lifecycle events (returned promises are awaited).

## Debugging

```js
self.__sw__.init({
  logLevel: "debug", // "debug" | "info" | "warn" | "error"
});
```
