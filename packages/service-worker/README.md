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
self.importScripts("@jsenv/service-worker/src/jsenv_service_worker.js")

self.__sw__.init({
  name: "product-name",
  // service worker will cache "/" and the "roboto" font
  resources: {
    "/": {},
    "https://fonts.googleapis.com/css2?family=Roboto": {},
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
self.__sw__.init({
  name: "product-name",
  resources: {
    "/": true,
-   "https://fonts.googleapis.com/css2?family=Roboto": {}
+   "https://fonts.googleapis.com/css2?family=Roboto": { version: '1' }
  },
})
```

# Symbiosis with jsenv build

During build jsenv injects urls to cache at the top of service worker file(s) under a global variable: `self.resourcesFromJsenvBuild`.

```js
self.importScripts("@jsenv/service-worker/src/jsenv_service_worker.js")

self.__sw__.init({
  name: "product-name",
  resources: {
    "/": true,
    ...(self.resourcesFromJsenvBuild || {}),
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
self.__sw__.init({
  cachePrefix: "product-name",
  resources: {
    "/": {},
+   "https://fonts.googleapis.com/css2?family=Roboto": {}
  },
})
```
