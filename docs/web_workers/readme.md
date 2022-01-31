# Using workers

Recommended way to use a [worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers):

```js
const workerUrl = new URL("./worker.js?worker", import.meta.url)
const worker = new Worker(workerUrl, { type: "module" })
```

> Jsenv could infer "worker.js" is a worker module by scanning source code but it could fail. It is better to be explicit and declare worker files using "?worker".

# Using service worker

```js
const serviceWorkerUrl = new URL(
  "./service_worker.js?service_worker",
  import.meta.url,
)
navigator.serviceWorker.register(serviceWorkerUrl, { type: "module" })
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
const workerUrl = new URL("./worker.js?worker_type_classic", import.meta.url)
const worker = new Worker(workerUrl)

const serviceWorkerUrl = new URL(
  "./service_worker.js?service_worker_type_classic",
  import.meta.url,
)
navigator.serviceWorker.register(serviceWorkerUrl)
```
