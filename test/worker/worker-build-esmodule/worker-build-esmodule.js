const workerUrl = String(new URL("/worker.js", import.meta.url))

const worker = new Worker(workerUrl)

export const workerPingPromise = new Promise((resolve, reject) => {
  worker.onmessage = (e) => {
    resolve(e.data)
  }
  worker.onerror = (e) => {
    reject(e.message)
  }
  worker.postMessage("ping")
})
