import { parentPort } from "node:worker_threads"
import {
  assertAndNormalizeDirectoryUrl,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem"
import { createLogger, loggerToLevels } from "@jsenv/logger"

import { createTaskLog } from "@jsenv/log"
import { getCallerPosition } from "@jsenv/urls"
import { initReloadableProcess } from "@jsenv/utils/process_reload/process_reload.js"
import { getCorePlugins } from "@jsenv/core/src/plugins/plugins.js"
import { createUrlGraph } from "@jsenv/core/src/omega/url_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen.js"
import { startOmegaServer } from "@jsenv/core/src/omega/omega_server.js"

import { jsenvPluginExplorer } from "./plugins/explorer/jsenv_plugin_explorer.js"
// import { jsenvPluginToolbar } from "./plugins/toolbar/jsenv_plugin_toolbar.js"

export const startDevServer = async ({
  signal = new AbortController().signal,
  handleSIGINT,
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
  rootDirectoryUrl,
  devServerFiles = {
    "./package.json": true,
    "./jsenv.config.mjs": true,
  },
  devServerMainFile = getCallerPosition().url,
  // force disable server autoreload when this code is executed:
  // - inside a forked child process
  // - inside a worker thread
  // (because node cluster won't work)
  devServerAutoreload = typeof process.send !== "function" &&
    !parentPort &&
    !process.env.VSCODE_INSPECTOR_OPTIONS,
  clientFiles = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git,.jsenv for instance)
    "./**/dist/": false,
    "./**/node_modules/": false,
  },
  cooldownBetweenFileEvents,
  clientAutoreload = true,

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
  injectedGlobals,
  nodeEsmResolution,
  fileSystemMagicResolution,
  transpilation,
  explorerGroups = {
    source: {
      "./*.html": true,
      "./src/**/*.html": true,
    },
    test: {
      "./test/**/*.test.html": true,
    },
  },
  // toolbar = false,
  writeGeneratedFiles = true,
}) => {
  const logger = createLogger({ logLevel })
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  const reloadableProcess = await initReloadableProcess({
    signal,
    handleSIGINT,
    ...(devServerAutoreload
      ? {
          enabled: true,
          logLevel: "warn",
          fileToRestart: devServerMainFile,
        }
      : {
          enabled: false,
        }),
  })
  if (reloadableProcess.isPrimary) {
    const devServerFileChangeCallback = ({ relativeUrl, event }) => {
      const url = new URL(relativeUrl, rootDirectoryUrl).href
      if (devServerAutoreload) {
        logger.info(`file ${event} ${url} -> restarting server...`)
        reloadableProcess.reload()
      }
    }
    const unregisterDevServerFilesWatcher = registerDirectoryLifecycle(
      rootDirectoryUrl,
      {
        watchPatterns: {
          [devServerMainFile]: true,
          ...devServerFiles,
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
    signal.addEventListener("abort", () => {
      unregisterDevServerFilesWatcher()
    })
    return {
      origin: `${protocol}://127.0.0.1:${port}`,
      stop: () => {
        unregisterDevServerFilesWatcher()
        reloadableProcess.stop()
      },
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
  const stopWatchingClientFiles = registerDirectoryLifecycle(rootDirectoryUrl, {
    watchPatterns: clientFiles,
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
        injectedGlobals,
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
  return {
    origin: server.origin,
    stop: () => {
      stopWatchingClientFiles()
      server.stop()
    },
  }
}
