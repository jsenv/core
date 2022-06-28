# Using workers

Recommended way to use a [worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers):

```js
const worker = new Worker("/worker.js", { type: "module" })
```

# Using service worker

```js
navigator.serviceWorker.register("/service_worker.js", { type: "module" })
```

# Classic web workers

A classic worker (or service worker) is executed in a context where [self.importScripts](https://developer.mozilla.org/en-US/docs/Web/API/WorkerGlobalScope/importScripts) is available and import/export are not.

This happens if you don't pass "type: 'module'" when creating the worker

```js
const worker = new Worker("/worker.js")
navigator.serviceWorker.register("/service_worker.js")
```
