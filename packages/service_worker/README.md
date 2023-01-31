<!-- https://web.dev/manifest-updates/ -->

# service-worker [![npm package](https://img.shields.io/npm/v/@jsenv/service-worker.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/service-worker)

_Short description of a service worker:_

Using a service worker allows to put url(s) into the navigator cache.
On the next visit navigator requests are served from cache.
For every url in cache, navigator won't do a request to the network.
If every url are in cache, website works offline.

_Jsenv service worker:_

- Ensure cache is reused only when url are versioned
- Can be connected to a build tool to know urls to put into navigator cache
- Can be configured with a manual list of urls to cache

# How to use

1. Install `@jsenv/service-worker`

```console
npm install @jsenv/worker
```

2. Create _service_worker.js_

```js
self.importScripts(
  "./node_modules/@jsenv/service-worker/src/jsenv_service_worker.js",
)

self.initJsenvServiceWorker({
  cachePrefix: "product-name",
  // service worker will cache "/" and the "roboto" font
  urlsConfig: {
    "/": true,
    "https://fonts.googleapis.com/css2?family=Roboto": true,
  },
})
```

3. Register service worker

```js
window.navigator.serviceWorker.register("./service_worker.js")
```

At this point your website will use jsenv service worker. By default jsenv service worker cache only the root url: `"/"`. It must be configured to cache more urls.

# Configuration

Jsenv service worker must be configured during "initJsenvServiceWorker" call.

Check directly [src/jsenv_service_worker.js](./src/jsenv_service_worker.js) to see the available configuration and what it does.

# Cache invalidation

When service worker updates it will refetch all url from network and put them into cache again. This is mandatory to check if ressource behind url has changed. When an url is versioned there is no need to refetch as it is assumed the ressource for that url will never change. If you know the url is versioned, tell it to the service worker as shown below.

```diff
self.initJsenvServiceWorker({
  cachePrefix: "product-name",
  urlsConfig: {
    "/": true,
-   "https://fonts.googleapis.com/css2?family=Roboto": true
+   "https://fonts.googleapis.com/css2?family=Roboto": { versioned: true }
  },
})
```

# Symbiosis with jsenv build

The list of urls to cache can be automatically generated when building files with `@jsenv/core`. This is possible because `self.generatedUrlsConfig` is injected into the script during build. This is documented in [jsenv service worker](https://github.com/jsenv/jsenv-core/blob/master/docs/building/readme.md#jsenv-service-worker)

```js
self.importScripts("./node_modules/@jsenv/pwa/src/jsenv_service_worker.js")

self.initJsenvServiceWorker({
  cachePrefix: "product-name",
  urlsConfig: {
    "/": true,
    ...(self.generatedUrlsConfig || {}),
  },
})
```

## Jsenv url detection

Jsenv will detect all urls referenced in your files such as:

```html
<link rel="preload" href="./src/img.png" as="image" />
```

```css
body {
  background-image: url("./src/img.png");
}
```

```js
new URL("./src/img.png", import.meta.url)
```

Urls detected during build will be in `self.generatedUrlsConfig`.

The urls with an origin different from your website origin will not. You must add them manually in "urlsConfig".

```html
<link
  rel="preload"
  href="https://fonts.googleapis.com/css2?family=Roboto"
  as="font"
  crossorigin
/>
```

```diff
self.initJsenvServiceWorker({
  cachePrefix: "product-name",
  urlsConfig: {
    "/": true,
+   "https://fonts.googleapis.com/css2?family=Roboto": true
  },
})
```

# High level overview

An high level overview of what happens when user visit your web application for the first time, second time and when there is an update.

Assuming your service worker script is at `./service_worker.js` and contains:

```js
self.importScripts(
  "./node_modules/@jsenv/service_worker/src/jsenv_service_worker.js",
)

self.initJsenvServiceWorker({
  cachePrefix: "product-name",
})
```

## User first visit

- At some point, your website executes the following js

  ```js
  window.navigator.serviceWorker.register("./service_worker.js")
  ```

- Navigator fetch/parse/execute `service_worker.js`

- Navigator trigger `"install"` event on the service worker. Jsenv service worker fetch all urls to cache on install and puts them into navigator cache using "cachePrefix" to generate a unique cache key.

- Navigator trigger `"activate"` event on the service worker

At this point service worker does not control the page. And **it's expected**. Read why in [controlling first visit](#controlling-first-visit). Service worker are meant to be a progressive enhancement, they are able to handle network for the next visit.

## User second visit

- Navigator is now _controlled_ by the service worker. All requests configured to be handled by the service worker will be intercepted.
- All request matching "shouldHandleRequest" will be served from cache if possible. If the url is not in cache, it is fetched from network and put into cache.

Assuming "urlsConfig" contains all urls needed by the website, page loads without any request to the network: **page works offline and loads super fast**.

## Website update

You update one of the files in your website, an image or some js files.

A process, ideally automatic, must update your _service_worker.js_ file. Without this the navigator won't see any change in the service worker file and consider there is nothing to update. If you use `@jsenv/core` to build your website, it is done for you as explained in [Symbiosis with jsenv build](#Symbiosis-with-jsenv-build).

## Navigator sees service worker file change

Navigator periodically fetches (every 24h) the url that was passed to `navigator.serviceWorker.register` and any scripts imported inside using `self.importScript`. If any file has changed, the service worker is considered as updated. This process also happens every time user loads or refresh the page.

When navigator see the service worker needs to update, here is what happens:

- Navigator spawns the new service worker code and trigger `"install"` event on it
- New service worker re fetch urls to cache on install
- Navigator waits for user to reload the page

At this point navigator tells us a new worker is _installed_ and ready to be _activated_. The website can know this thanks to [listenUpdateChange](../readme.md#listenUpdateChange) and display a message to the user to encourage him to reload the page. Once all page are closed, navigator will kill the previous service worker.

## User reloads the page

As there is no page left using the old service worker it is killed by the navigator. Navigator also trigger `"activate"` event on the new worker. New worker react to the activate event and deletes cache of every url from the previous worker to save disk space.

## Programmatic cache invalidation

It's possible to control service worker cache as shown below:

```js
import { createServiceWorkerScript } from "@jsenv/pwa"

const script = createServiceWorkerScript()
const result = await script.sendMessage({
  action: "removeCacheKey",
  payload: "https://fonts.googleapis.com/css2?family=Roboto",
})

// result can be:
//   - undefined: no service worker controlling the page
//   - false: there is no cache to remove for that url
//   - true: cache was removed
```

# Controlling first visit

The whole website could wait for service worker to be installed before doing anything with the following code

```js
await navigator.serviceWorker.ready
```

But it has a huge performance impact. This is not how service worker were designed by web browsers.

We could also take control of the navigator as soon as possible with the following code in the service worker

```js
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})
```

But in that scenario service worker and user visiting the page happens in parallel. So by the time service worker install and activates it have missed many of the requests done by the navigator. You end up in a non predictable state.

In the end it is way simpler and safe to consider a service worker can control a navigator only from the very beginning.

<!-- ## See also

- https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage/open -->
