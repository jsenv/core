import { Worker } from "worker_threads"
import { assertAndNormalizeFileUrl, urlToFileSystemPath } from "@jsenv/util"

export const collectWorkerMessages = async (workerFileUrl) => {
  workerFileUrl = assertAndNormalizeFileUrl(workerFileUrl)
  const worker = new Worker(urlToFileSystemPath(workerFileUrl))
  return new Promise((resolve, reject) => {
    const messages = []
    worker.on("error", (e) => {
      worker.terminate()
      reject(e)
    })
    worker.on("message", (message) => {
      messages.push(message)
    })
    worker.on("exit", () => {
      resolve(messages)
    })
  })
}
