# @jsenv/service-worker [![npm package](https://img.shields.io/npm/v/@jsenv/service-worker.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/service-worker)

A powerful service worker implementation for seamless offline experiences.

🔄 Smart caching with version-aware invalidation  
🛠️ Compatible with build workflows (auto-detection of assets)  
⚡ Optimized for performance and reliability  
🔌 Simple configuration for any web project

## Introduction

Service workers enable web applications to work offline by caching resources. The @jsenv/service-worker package provides a simple yet powerful implementation that:

- Ensures cache is reused only when URLs are versioned
- Connects to build tools to automatically discover cacheable resources
- Allows manual configuration of URLs to cache
- Provides smart cache invalidation strategies

## Quick Start

### 1. Install the package

```console
npm install @jsenv/service-worker
```

### 2. Create a service worker file

```js
// service_worker.js
self.importScripts("@jsenv/service-worker/src/jsenv_service_worker.js");

self.__sw__.init({
  name: "my-app",
  resources: {
    "/": {}, // Cache root URL
    "https://fonts.googleapis.com/css2?family=Roboto": {}, // Cache external font
  },
});
```

### 3. Register the service worker

```js
// In your main application code
if ("serviceWorker" in navigator) {
  window.navigator.serviceWorker.register("./service_worker.js");
}
```

## Configuration

Configure the service worker during the `__sw__.init()` call:

```js
self.__sw__.init({
  // Required: Used as prefix for cache storage
  name: "my-app-name",

  // Optional: Resources to cache (default: { "/": {} })
  resources: {
    "/": {}, // Root path
    "/index.html": {}, // Specific file
    "/assets/styles.css": {}, // CSS file
    "/assets/app.js": { version: "1.0" }, // Versioned JavaScript file
    "https://example.com/api": { maxAge: 3600 }, // External URL with max age
  },

  // Optional: Cache name prefix (default: value of "name")
  cacheNamePrefix: "my-app-cache",

  // Optional: Log level (default: "warn")
  logLevel: "info", // "debug", "info", "warn", "error", or "off"
});
```

## Smart Cache Invalidation

When a service worker updates, it refetches all URLs from the network by default. However, for versioned resources that never change, you can optimize this process:

```js
self.__sw__.init({
  name: "my-app",
  resources: {
    "/": {}, // Unversioned: will be refetched on service worker update
    "/assets/main.a7b3c9d.js": { version: "a7b3c9d" }, // Versioned: won't be refetched
    "/api/data.json": { maxAge: 3600 }, // Cache for 1 hour (3600 seconds)
  },
});
```

## Integration with Build Tools

@jsenv/service-worker can automatically detect resources during build time. The build process injects discovered URLs at the top of your service worker file under `self.resourcesFromJsenvBuild`.

```js
// service_worker.js
self.importScripts("@jsenv/service-worker/src/jsenv_service_worker.js");

self.__sw__.init({
  name: "my-app",
  resources: {
    "/": {},
    // Combine manually specified resources with those from build
    ...(self.resourcesFromJsenvBuild || {}),
  },
});
```

### Resource Detection

Jsenv will automatically detect URLs referenced in your files:

```html
<!-- In HTML -->
<link rel="preload" href="./assets/image.png" as="image" />
```

```css
/* In CSS */
body {
  background-image: url("./assets/background.png");
}
```

```js
// In JavaScript
new URL("./assets/icon.svg", import.meta.url);
```

### External Resources

External resources (from different origins) must be added manually:

```js
self.__sw__.init({
  name: "my-app",
  resources: {
    "/": {},
    ...(self.resourcesFromJsenvBuild || {}),
    // External resources must be added manually
    "https://fonts.googleapis.com/css2?family=Roboto": {},
    "https://cdn.example.com/library.js": { version: "2.0" },
  },
});
```

## Advanced Usage

### Custom Fetch Handling

```js
self.__sw__.init({
  name: "my-app",
  resources: {
    "/": {},
    "/api/data": {
      // Custom fetch handler for API responses
      fetchHandler: async (request) => {
        try {
          // Try network first
          const networkResponse = await fetch(request);
          if (networkResponse.ok) {
            return networkResponse;
          }
          throw new Error("Network response not ok");
        } catch (error) {
          // Fall back to cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return a custom offline response
          return new Response(JSON.stringify({ error: "You are offline" }), {
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
```

### Precaching Strategies

```js
self.__sw__.init({
  name: "my-app",
  resources: {
    "/": {},
    // Core assets (always precached)
    "/assets/critical.js": { importance: "high" },
    // Non-critical assets (precached when idle)
    "/assets/non-critical.js": { importance: "low" },
  },
});
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](./LICENSE)
