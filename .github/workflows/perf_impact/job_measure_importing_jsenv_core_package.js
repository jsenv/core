import { parentPort } from "worker_threads"

const start = Date.now()
await import(`@jsenv/core`)
const end = Date.now()
parentPort.postMessage(end - start)
