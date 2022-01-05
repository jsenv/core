# Using workers

Recommended way to use a [worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers):

```js
const workerUrl = new URL("./worker.js", import.meta.url)
const worker = new Worker(workerUrl, { type: "module" })
```

You must tell jsenv which files are worker modules.

_jsenv.config.mjs:_

```js
export const projectDirectoryUrl = new URL("./", import.meta.url)

export const workers = ["./worker.js"]
```

> Jsenv might infer "worker.js" is a worker module from source code but this could fail. For now, worker files must be explicitely declared as such using "workers".

# Using service worker

```js
const serviceWorkerUrl = new URL("./service_worker.js", import.meta.url)
navigator.serviceWorker.register(serviceWorkerUrl, { type: "module" })
```

Here again tell jsenv it's a module service worker.

_jsenv.config.mjs:_

```js
export const projectDirectoryUrl = new URL("./", import.meta.url)

export const serviceWorkers = ["./service_worker.js"]
```

# Web workers and importmap

You can use importmap in your worker files but this is not yet supported by browsers. If you do that you must tell jsenv using "importmapInWebWorkers".

_jsenv.config.mjs:_

```js
// tell jsenv we use importmap in workers, jsenv will transform files
// to make them compatible with importmaps
export const importmapInWebWorkers = true
```

# Classic web workers

A classic worker (or service worker) is executed in a context where [self.importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts) is available and import/export are not.

This happens if you don't pass "type: 'module'" when creating the worker

```js
const workerUrl = new URL("./worker.js", import.meta.url)
const worker = new Worker(workerUrl)

const serviceWorkerUrl = new URL("./service_worker.js", import.meta.url)
navigator.serviceWorker.register(serviceWorkerUrl)
```

If you do that, worker files must be configured using "classicWorkers" and "classicServiceWorkers" instead of "workers" and "serviceWorkers".

_jsenv.config.mjs:_

```js
export const projectDirectoryUrl = new URL("./", import.meta.url)

export const classicWorkers = ["./worker.js"]
export const classicServiceWorkers = ["./service_worker.js"]
```
