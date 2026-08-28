# @jsenv/service-worker [![npm package](https://img.shields.io/npm/v/@jsenv/service-worker.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/service-worker)

A ready-made service worker for seamless offline experiences.

🔄 Smart caching with version-aware invalidation  
🛠️ Auto-detection of assets when building with @jsenv/core  
🔌 Simple configuration for any web project  
📨 Works with [@jsenv/pwa](https://github.com/jsenv/core/tree/main/packages/frontend/pwa) for update UI and hot resource replacement

Complete usage examples live in [docs/usage.md](./docs/usage.md); the JSDoc on
`sw.init` in [src/jsenv_service_worker.js](./src/jsenv_service_worker.js) is
the API reference.

## Introduction

Service workers enable web applications to work offline by caching resources.
This package provides an implementation that:

- Caches your resources during install and serves them from cache
- Refetches unversioned urls at every install; versioned urls go through the
  HTTP cache, so an unchanged file need not be downloaded again
- Cleans up caches from previous worker versions on activate
- Answers the message protocol used by `@jsenv/pwa` (inspect, skipWaiting,
  claim, custom actions)

## Quick Start

### 1. Install the package

```console
npm install @jsenv/service-worker
```

### 2. Create a service worker file

```js
// sw.js
self.importScripts("@jsenv/service-worker");

self.__sw__.init({
  name: "my-app",
  resources: {
    "/": {},
    ...(self.resourcesFromJsenvBuild || {}),
  },
});
```

The bare specifier is resolved by jsenv (dev server and build). Outside jsenv,
point at the file instead — the path is relative to the worker file's own url:
`self.importScripts("./node_modules/@jsenv/service-worker/src/jsenv_service_worker.js")`.

### 3. Register the service worker

```js
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
```

## Configuration

All `init` options:

```js
self.__sw__.init({
  // Prefix identifying the caches created by this service worker,
  // so a new version can delete the caches of the previous one
  name: "my-app", // default "jsenv"

  // Urls cached during install and served from cache.
  // {} -> unversioned: refetched from network on every install
  // { version, versionedUrl } -> immutable: the HTTP cache may answer
  resources: {
    "/": {},
    "/assets/main.js": { version: "a7b3c9d" },
  },

  // Bump when the new worker script must NOT be hot-updated by @jsenv/pwa
  // (forces a full reload after update)
  version: "1",

  // Extra values returned to the page by the "inspect" action
  meta: {},

  // Extra { action: async fn } handlers callable from the page
  actions: {},

  // Extra work during lifecycle events (returned promises are awaited)
  install: () => {},
  activate: () => {},

  // "debug" | "info" | "warn" | "error"
  logLevel: "warn",
});
```

Requests for urls not listed in `resources` are untouched: the browser handles
them as usual.

## Integration with jsenv build

When building with [@jsenv/core](https://github.com/jsenv/core), the build
detects the `navigator.serviceWorker.register(...)` call and treats the worker
as an entry point: what it loads with `importScripts` is copied to the build
and versioned, and `self.resourcesFromJsenvBuild` is prepended to it — every
file of the build (except the worker itself) with its version and versioned
url. Spreading it into `resources` (as in the Quick Start) is the whole
integration:

- versioned urls (`/css/style.css?v=0e312d1c`) are served from cache and,
  being immutable, can come from the HTTP cache at the next install instead of
  being downloaded again
- unversioned urls (like `/main.html`) get a computed `version`, so the worker
  script bytes change — and the browser detects an update — whenever their
  content changes

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

## Update UI on the page

Pair with `@jsenv/pwa` to display "an update is available", activate it on
click, and hot-replace changed resources without reloading when possible — see
[docs/usage.md](./docs/usage.md#update-flow).
