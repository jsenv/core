import { ping } from "/js/ping.js?v=70ef69dd"

const testWorker = async (worker) => {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      resolve(e.data)
    }
    worker.onerror = (e) => {
      reject(e.message)
    }
    worker.postMessage("ping")
  })
}

const worker = new Worker("/worker.js", { type: "module" })
const workerResponse = await testWorker(worker)

window.resolveResultPromise({
  ping,
  workerResponse,
})
