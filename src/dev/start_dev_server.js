import { parentPort } from "node:worker_threads"
import {
  assertAndNormalizeDirectoryUrl,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import { createLogger, createTaskLog } from "@jsenv/log"
import { getCallerPosition } from "@jsenv/urls"

import { defaultRuntimeCompat } from "@jsenv/core/src/build/build.js"
import { createReloadableWorker } from "@jsenv/core/src/helpers/worker_reload.js"
import { startOmegaServer } from "@jsenv/core/src/omega/omega_server.js"

export const startDevServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  omegaServerLogLevel = "warn",
  protocol = "http",
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
  certificate,
  privateKey,
  hostname,
  port = 3456,
  acceptAnyIp,
  keepProcessAlive = true,
  services,

  rootDirectoryUrl,
  clientFiles = {
    "./src/": true,
    "./tests/": true,
    "./package.json": true,
  },
  devServerFiles = {
    "./package.json": true,
    "./jsenv.config.mjs": true,
  },
  clientAutoreload = true,
  clientMainFileUrl,
  devServerAutoreload = false,
  devServerMainFile = getCallerPosition().url,
  cooldownBetweenFileEvents,

  // runtimeCompat is the runtimeCompat for the build
  // when specified, dev server use it to warn in case
  // code would be supported during dev but not after build
  runtimeCompat = defaultRuntimeCompat,
  plugins = [],
  urlAnalysis = {},
  supervisor = true,
  nodeEsmResolution,
  fileSystemMagicResolution,
  transpilation,
  explorer = true, // see jsenv_plugin_explorer.js
  // toolbar = false,

  sourcemaps = "inline",
  sourcemapsSourcesProtocol,
  sourcemapsSourcesContent,
  // no real need to write files during github workflow
  // and mitigates https://github.com/actions/runner-images/issues/3885
  writeGeneratedFiles = !process.env.CI,
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
      const origin = await messagePromise
      return {
        origin,
        stop: () => {
          stopWatchingDevServerFiles()
          reloadableWorker.terminate()
        },
      }
    }
  }

  const startDevServerTask = createTaskLog("start dev server", {
    disabled: !logger.levels.info,
  })

  const server = await startOmegaServer({
    logLevel: omegaServerLogLevel,
    keepProcessAlive,
    acceptAnyIp,
    protocol,
    http2,
    certificate,
    privateKey,
    hostname,
    port,
    services,

    rootDirectoryUrl,
    scenarios: { dev: true },
    runtimeCompat,

    plugins,
    urlAnalysis,
    supervisor,
    nodeEsmResolution,
    fileSystemMagicResolution,
    transpilation,
    clientFiles,
    clientMainFileUrl,
    clientAutoreload,
    cooldownBetweenFileEvents,
    explorer,
    sourcemaps,
    sourcemapsSourcesProtocol,
    sourcemapsSourcesContent,
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
