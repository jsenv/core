import { Worker } from "worker_threads"

import { urlToFileSystemPath } from "@jsenv/util"

const workerFileExecution = urlToFileSystemPath(
  new URL("./file_execution_worker.js", import.meta.url),
)

export const executeFile = async (fileUrl) => {
  const worker = new Worker(workerFileExecution, {
    workerData: {
      fileUrl: String(fileUrl),
    },
  })
  return new Promise((resolve, reject) => {
    const messages = []
    worker.on("error", (error) => {
      worker.terminate()
      reject(error)
    })
    worker.on("message", (message) => {
      messages.push(message)
    })
    worker.on("exit", () => {
      resolve(messages)
    })
  })
}
