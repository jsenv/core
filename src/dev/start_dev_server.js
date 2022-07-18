import { parentPort } from "node:worker_threads"
import { findFreePort } from "@jsenv/server"
import {
  assertAndNormalizeDirectoryUrl,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem"
import { Abort, raceProcessTeardownEvents } from "@jsenv/abort"
import { createLogger, loggerToLevels, createTaskLog } from "@jsenv/log"
import { getCallerPosition } from "@jsenv/urls"
import { URL_META } from "@jsenv/url-meta"

import { createReloadableWorker } from "@jsenv/core/src/helpers/worker_reload.js"
import { getCorePlugins } from "@jsenv/core/src/plugins/plugins.js"
import { createUrlGraph } from "@jsenv/core/src/omega/url_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen.js"
import { startOmegaServer } from "@jsenv/core/src/omega/omega_server.js"

import { jsenvPluginExplorer } from "./plugins/explorer/jsenv_plugin_explorer.js"
import { jsenvPluginServerEvents } from "./plugins/server_events/jsenv_plugin_server_events.js"

export const startDevServer = async ({
  signal = new AbortController().signal,
  handleSIGINT = true,
  logLevel = "info",
  omegaServerLogLevel = "warn",
  port = 3456,
  protocol = "http",
  listenAnyIp,
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
  certificate,
  privateKey,
  keepProcessAlive = true,
  serverPlugins,

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

  sourcemaps = "inline",
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
  explorerGroups = {
    source: {
      "./*.html": true,
      "./src/**/*.html": true,
    },
    test: {
      "./tests/**/*.test.html": true,
    },
  },
  // toolbar = false,
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

  const clientFileChangeCallbackList = []
  const clientFilesPruneCallbackList = []
  const clientFileChangeCallback = ({ relativeUrl, event }) => {
    const url = new URL(relativeUrl, rootDirectoryUrl).href
    clientFileChangeCallbackList.forEach((callback) => {
      callback({ url, event })
    })
  }

  const clientFilePatterns = {
    ...clientFiles,
    ".jsenv/": false,
  }
  const watchAssociations = URL_META.resolveAssociations(
    {
      watch: clientFilePatterns,
    },
    rootDirectoryUrl,
  )
  const stopWatchingClientFiles = registerDirectoryLifecycle(rootDirectoryUrl, {
    watchPatterns: clientFilePatterns,
    cooldownBetweenFileEvents,
    keepProcessAlive: false,
    recursive: true,
    added: ({ relativeUrl }) => {
      clientFileChangeCallback({ event: "added", relativeUrl })
    },
    updated: ({ relativeUrl }) => {
      clientFileChangeCallback({ event: "modified", relativeUrl })
    },
    removed: ({ relativeUrl }) => {
      clientFileChangeCallback({ event: "removed", relativeUrl })
    },
  })
  const urlGraph = createUrlGraph({
    clientFileChangeCallbackList,
    clientFilesPruneCallbackList,
    onCreateUrlInfo: (urlInfo) => {
      const { watch } = URL_META.applyAssociations({
        url: urlInfo.url,
        associations: watchAssociations,
      })
      urlInfo.isWatched = watch
    },
  })
  const kitchen = createKitchen({
    signal,
    logger,
    rootDirectoryUrl,
    urlGraph,
    scenario: "dev",
    runtimeCompat,
    sourcemaps,
    writeGeneratedFiles,
    plugins: [
      ...plugins,
      ...getCorePlugins({
        rootDirectoryUrl,
        urlGraph,
        scenario: "dev",
        runtimeCompat,

        urlAnalysis,
        htmlSupervisor,
        nodeEsmResolution,
        fileSystemMagicResolution,
        transpilation,
        clientAutoreload,
        clientFileChangeCallbackList,
        clientFilesPruneCallbackList,
      }),
      jsenvPluginExplorer({
        groups: explorerGroups,
      }),
      // ...(toolbar ? [jsenvPluginToolbar(toolbar)] : []),
    ],
  })

  const onErrorWhileServingFileReference = { current: () => {} }
  jsenvPluginServerEvents({
    rootDirectoryUrl,
    urlGraph,
    kitchen,
    scenario: "dev",
    onErrorWhileServingFileReference,
  })

  const server = await startOmegaServer({
    logLevel: omegaServerLogLevel,
    keepProcessAlive,
    listenAnyIp,
    port,
    protocol,
    http2,
    certificate,
    privateKey,
    rootDirectoryUrl,
    urlGraph,
    kitchen,
    scenario: "dev",
    serverPlugins,
    onErrorWhileServingFile: (data) => {
      onErrorWhileServingFileReference.current(data)
    },
  })
  startDevServerTask.done()
  logger.info(``)
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`)
  })
  logger.info(``)
  server.addEffect(() => {
    return () => {
      kitchen.pluginController.callHooks("destroy", {})
    }
  })
  if (reloadableWorker && reloadableWorker.isWorker) {
    parentPort.postMessage(server.origin)
  }
  return {
    origin: server.origin,
    stop: () => {
      stopWatchingClientFiles()
      server.stop()
    },
  }
}
