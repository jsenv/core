const testWorker = async (worker) => {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data !== "__importmap_request__") {
        resolve(e.data)
      }
    }
    worker.onerror = (e) => {
      reject(e.message)
    }
    worker.postMessage("ping")
  })
}

const worker = new Worker("/worker.js", { type: "module" })
export const workerResponse = await testWorker(worker)

const worker2 = new Worker(new URL("./worker.js", import.meta.url), {
  type: "module",
})
export const worker2Response = await testWorker(worker2)
