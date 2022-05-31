/*
 * This file uses "@jsenv/core" to start a development server.
 * https://github.com/jsenv/jsenv-core/blob/master/docs/dev_server/readme.md#jsenv-dev-server
 */

import cluster from "node:cluster"
import { cpus } from "node:os"
import { fileURLToPath } from "node:url"

const numCPUs = cpus().length

cluster.setupMaster({
  exec: fileURLToPath(new URL("./profile_dev_server.js", import.meta.url)),
})

// Fork workers.
for (let i = 0; i < numCPUs; i++) {
  console.log(`forking`)
  cluster.fork()
}

cluster.on("online", function (worker) {
  console.log(`Worker ${worker.process.pid} is online`)
})

cluster.on("exit", function (worker, code, signal) {
  console.log(
    `Worker ${worker.process.pid} died with code: ${code}, and signal: ${signal}`,
  )
  console.log("Starting a new worker")
  cluster.fork()
})
