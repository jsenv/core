import { parentPort } from "node:worker_threads"
import { findFreePort } from "@jsenv/server"
import {
  assertAndNormalizeDirectoryUrl,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import { createLogger, loggerToLevels, createTaskLog } from "@jsenv/log"
import { getCallerPosition } from "@jsenv/urls"

import { createReloadableWorker } from "@jsenv/core/src/helpers/worker_reload.js"
import { startOmegaServer } from "@jsenv/core/src/omega/omega_server.js"

export const startDevServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  omegaServerLogLevel = "warn",
  port = 3456,
  protocol = "http",
  acceptAnyIp,
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
  certificate,
  privateKey,
  keepProcessAlive = true,
  services,

  rootDirectoryUrl,
  clientFiles = {
    "./src/": true,
    "./tests/": true,
  },
  devServerFiles = {
    "./package.json": true,
    "./jsenv.config.mjs": true,
  },
  clientAutoreload = true,
  devServerAutoreload = false,
  devServerMainFile = getCallerPosition().url,
  cooldownBetweenFileEvents,

  // default runtimeCompat assume dev server will be request by recent browsers
  // Used by "jsenv_plugin_node_runtime.js" to deactivate itself
  // If dev server can be requested by Node.js to exec files
  // we would add "node" to the potential runtimes. For now it's out of the scope of the dev server
  // and "jsenv_plugin_node_runtime.js" applies only during build made for node.js
  runtimeCompat = {
    chrome: "100",
    firefox: "100",
    safari: "15.5",
  },
  plugins = [],
  urlAnalysis = {},
  htmlSupervisor = true,
  nodeEsmResolution,
  fileSystemMagicResolution,
  transpilation,
  explorer = {
    groups: {
      src: {
        "./src/**/*.html": true,
      },
      tests: {
        "./tests/**/*.test.html": true,
      },
    },
  },
  // toolbar = false,

  sourcemaps = "inline",
  writeGeneratedFiles = true,
}) => {
  const logger = createLogger({ logLevel })
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
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
  if (port === 0) {
    port = await findFreePort(port, { signal: operation.signal })
  }

  let reloadableWorker
  if (devServerAutoreload) {
    reloadableWorker = createReloadableWorker(devServerMainFile)
    if (reloadableWorker.isPrimary) {
      const devServerFileChangeCallback = ({ relativeUrl, event }) => {
        const url = new URL(relativeUrl, rootDirectoryUrl).href
        logger.info(`file ${event} ${url} -> restarting server...`)
        reloadableWorker.reload()
      }
      const stopWatchingDevServerFiles = registerDirectoryLifecycle(
        rootDirectoryUrl,
        {
          watchPatterns: {
            ...devServerFiles.include,
            [devServerMainFile]: true,
            ".jsenv/": false,
          },
          cooldownBetweenFileEvents,
          keepProcessAlive: false,
          recursive: true,
          added: ({ relativeUrl }) => {
            devServerFileChangeCallback({ relativeUrl, event: "added" })
          },
          updated: ({ relativeUrl }) => {
            devServerFileChangeCallback({ relativeUrl, event: "modified" })
          },
          removed: ({ relativeUrl }) => {
            devServerFileChangeCallback({ relativeUrl, event: "removed" })
          },
        },
      )
      operation.addAbortCallback(() => {
        stopWatchingDevServerFiles()
        reloadableWorker.terminate()
      })

      const worker = await reloadableWorker.load()
      const messagePromise = new Promise((resolve) => {
        worker.once("message", resolve)
      })
      await messagePromise
      // if (!keepProcessAlive) {
      //   worker.unref()
      // }
      return {
        origin: `${protocol}://127.0.0.1:${port}`,
        stop: () => {
          stopWatchingDevServerFiles()
          reloadableWorker.terminate()
        },
      }
    }
  }

  const startDevServerTask = createTaskLog("start dev server", {
    disabled: !loggerToLevels(logger).info,
  })

  const server = await startOmegaServer({
    logLevel: omegaServerLogLevel,
    keepProcessAlive,
    acceptAnyIp,
    port,
    protocol,
    http2,
    certificate,
    privateKey,
    services,

    rootDirectoryUrl,
    scenario: "dev",
    runtimeCompat,
    plugins,
    urlAnalysis,
    htmlSupervisor,
    nodeEsmResolution,
    fileSystemMagicResolution,
    transpilation,
    clientFiles,
    clientAutoreload,
    cooldownBetweenFileEvents,
    explorer,
    sourcemaps,
    writeGeneratedFiles,
  })
  startDevServerTask.done()
  logger.info(``)
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`)
  })
  logger.info(``)
  if (reloadableWorker && reloadableWorker.isWorker) {
    parentPort.postMessage(server.origin)
  }
  return {
    origin: server.origin,
    stop: () => {
      server.stop()
    },
  }
}
