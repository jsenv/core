import cluster from "node:cluster"
import { fileURLToPath } from "node:url"
import { createLogger } from "@jsenv/logger"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"

export const isRestartProcess = cluster.isWorker

// https://nodejs.org/api/cluster.html
export const initReloadableProcess = async ({
  signal,
  handleSIGINT = true,
  logLevel,
  enabled = true,
  fileToRestart,
}) => {
  if (cluster.isWorker) {
    // Code is interacting with the primary process, the worker is used
    // to make process restartable so:
    // - worker can return a dormant abort signal (never aborted) because
    // it's the primary process who is handling the abort by killing the worker process
    // - we can return a noop stop function because it's again the primary process
    // who returned a stop function that would kill the worker when called
    return {
      isPrimary: false,
      signal,
      stop: () => {},
    }
  }
  // we create the signal here either because the primary process want to listen it
  // or because autorestart is disabled and the caller will use the abort signal
  // in the current process
  const operation = Abort.startOperation()
  operation.addAbortSignal(signal)
  if (handleSIGINT) {
    operation.addAbortSource((abort) => {
      return raceProcessTeardownEvents(
        {
          SIGINT: true,
        },
        abort,
      )
    })
  }
  if (!enabled) {
    return {
      isPrimary: false,
      signal: operation.signal,
      stop: () => {},
    }
  }

  const logger = createLogger({ logLevel })
  const startWorker = () => {
    cluster.fork()
  }

  logger.debug(`setup primary ${fileToRestart}`)
  cluster.setupPrimary({
    exec: fileURLToPath(fileToRestart),
  })
  cluster.on("online", (worker) => {
    logger.debug(`worker ${worker.process.pid} is online`)
  })

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

  const stop = () => {
    cluster.removeListener("exit", exitEventCallback)
    killWorkers()
  }
  signal.addEventListener("abort", () => {
    stop()
  })
  startWorker()
  return {
    isPrimary: true,
    signal: operation.signal,
    stop,
    reload: () => {
      killWorkers()
    },
  }
}
