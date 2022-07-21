_cluster_demo_server.mjs:_

```js
import { startServer, fetchFileSystem } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: (request) => {
        return fetchFileSystem(
          new URL(request.ressource.slice(1), import.meta.url),
          {
            ...request,
          },
        )
      },
    },
  ],
})
```

_cluster_demo_primary.mjs_

```js
import cluster from "node:cluster"
import { cpus } from "node:os"
import { fileURLToPath } from "node:url"

const numCPUs = cpus().length

cluster.setupPrimary({
  exec: fileURLToPath(new URL("./cluster_demo_server.mjs", import.meta.url)),
})

console.log(`Primary ${process.pid} is running`)
for (let i = 0; i < numCPUs; i++) {
  cluster.fork()
}

cluster.on("online", (worker) => {
  console.log(`Worker ${worker.process.pid} is online`)
})

cluster.on("exit", (worker, code, signal) => {
  if (signal !== "SIGKILL") {
    console.log(
      `Worker ${worker.process.pid} died with code: ${code}, and signal: ${signal}`,
    )
    console.log(`Starting a new worker`)
    cluster.fork()
  }
})
```

```console
❯ node ./docs/cluster/cluster_demo_primary.mjs
Primary 42398 is running
Worker 42399 is online
Worker 42400 is online
Worker 42401 is online
Worker 42402 is online
server started at http://localhost:60000 (http://192.168.1.15:60000)
server started at http://localhost:60000 (http://192.168.1.15:60000)
server started at http://localhost:60000 (http://192.168.1.15:60000)
server started at http://localhost:60000 (http://192.168.1.15:60000)
```

# Restart on file change

```diff
import cluster from "node:cluster"
import { cpus } from "node:os"
import { fileURLToPath } from "node:url"
+ import { registerFileLifecycle } from "@jsenv/filesystem"

const numCPUs = cpus().length

const workerFileUrl = new URL("./cluster_demo_server.mjs", import.meta.url)

cluster.setupPrimary({
  exec: fileURLToPath(workerFileUrl),
})

console.log(`Primary ${process.pid} is running`)
for (let i = 0; i < numCPUs; i++) {
  cluster.fork()
}

cluster.on("online", (worker) => {
  console.log(`Worker ${worker.process.pid} is online`)
})

cluster.on("exit", (worker, code, signal) => {
  // https://nodejs.org/dist/latest-v16.x/docs/api/cluster.html#workerexitedafterdisconnect
  if (worker.exitedAfterDisconnect) {
    console.log(
      `Worker ${worker.process.pid} died with code: ${code}, and signal: ${signal}`,
    )
    console.log(`Starting a new worker`)
    cluster.fork()
  }
})

+ registerFileLifecycle(workerFileUrl, {
+   updated: () => {
+     console.log("Server file updated, restarting servers...")
+
+     Object.keys(cluster.workers).forEach((workerId) => {
+       const worker = cluster.workers[workerId]
+
+       // force kill if graceful exit fails
+       const timeout = setTimeout(() => {
+         worker.kill("SIGKILL")
+       }, 5000)
+       worker.once("exit", () => {
+         clearTimeout(timeout)
+       })
+       // try gracefull exit
+       worker.kill()
+     })
+   },
+ })
```
