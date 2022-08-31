// this is causing an import to babel helper for object spread
console.log({
  ...{ answer: 42 },
})
// this would crash the worker if that code was shared and executed
// in the worker context
window.toto = true

// eslint-disable-next-line no-new
const worker = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
})

const workerResponse = await new Promise((resolve, reject) => {
  worker.onmessage = (e) => {
    resolve(e.data)
  }
  worker.onerror = (e) => {
    reject(e.message)
  }
  worker.postMessage("ping")
})

window.resolveResultPromise({
  workerResponse,
})
