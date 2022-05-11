import cluster from "node:cluster"
import { fileURLToPath } from "node:url"
import { registerFileLifecycle } from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import { guardTooFastSecondCall } from "./guard_second_call.js"

export const setupFileRestart = async ({
  signal,
  autorestart,
  injectedUrlsToWatch,
  job,
}) => {
  if (!autorestart) {
    await job()
    return
  }
  if (cluster.isWorker) {
    await job()
    return
  }
  const { logLevel, urlToFork, urlsToWatch = [] } = autorestart
  const urls = [urlToFork, ...urlsToWatch, ...injectedUrlsToWatch].map((url) =>
    String(url),
  )
  const logger = createLogger({ logLevel })
  const startWorker = () => {
    cluster.fork()
  }

  logger.debug(`setup primary ${urlToFork}`)
  cluster.setupPrimary({
    exec: fileURLToPath(urlToFork),
  })
  cluster.on("online", (worker) => {
    logger.debug(`worker ${worker.process.pid} is online`)
  })
  const exitEventCallback = (worker, code, signal) => {
    // https://nodejs.org/dist/latest-v16.x/docs/api/cluster.html#workerexitedafterdisconnect
    if (worker.exitedAfterDisconnect) {
      logger.debug(
        `worker ${worker.process.pid} died with code: ${code}, and signal: ${signal}`,
      )
      logger.debug(`starting a new worker`)

      startWorker()
    }
  }
  cluster.on("exit", exitEventCallback)

  const killWorkers = () => {
    Object.keys(cluster.workers).forEach((workerId) => {
      const worker = cluster.workers[workerId]
      // force kill if graceful exit fails
      const timeout = setTimeout(() => {
        worker.kill("SIGKILL")
      }, 5000)
      worker.once("exit", () => {
        clearTimeout(timeout)
      })
      // try gracefull exit
      worker.kill()
    })
  }

  const onFileEvent = guardTooFastSecondCall(({ url, event }) => {
    logger.info(`file ${event} ${url} -> restarting...`)
    killWorkers()
  }, 50)
  const unregisters = urls.map((url) => {
    return registerFileLifecycle(url, {
      added: () => {
        onFileEvent({ url, event: "added" })
      },
      updated: () => {
        onFileEvent({ url, event: "modified" })
      },
      removed: () => {
        onFileEvent({ url, event: "removed" })
      },
    })
  })

  signal.addEventListener("abort", () => {
    unregisters.forEach((unregister) => {
      unregister()
    })
    cluster.removeListener("exit", exitEventCallback)
    killWorkers()
  })

  startWorker()
}
