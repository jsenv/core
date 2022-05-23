import {
  assertAndNormalizeDirectoryUrl,
  registerDirectoryLifecycle,
} from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import { initProcessAutorestart } from "@jsenv/utils/file_watcher/process_auto_restart.js"
import { createTaskLog } from "@jsenv/utils/logs/task_log.js"
import { getCorePlugins } from "@jsenv/core/src/plugins/plugins.js"
import { createUrlGraph } from "@jsenv/core/src/omega/url_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen.js"
import { startOmegaServer } from "@jsenv/core/src/omega/omega_server.js"

import { jsenvPluginExplorer } from "./plugins/explorer/jsenv_plugin_explorer.js"
import { jsenvPluginToolbar } from "./plugins/toolbar/jsenv_plugin_toolbar.js"

export const startDevServer = async ({
  signal = new AbortController().signal,
  handleSIGINT,
  logLevel = "warn",
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
  clientFiles = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git,.jsenv for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
  serverFiles = {
    "./package.json": true,
    "./jsenv.config.mjs": true,
  },
  cooldownBetweenFileEvents,
  clientAutoreload = true,
  serverAutoreloadFile,
  serverAutoreload = false,

  sourcemaps = "inline",
  plugins = [],
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
  toolbar = false,
}) => {
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  const autorestartProcess = await initProcessAutorestart({
    signal,
    handleSIGINT,
    ...(serverAutoreload
      ? {
          enabled: true,
          logLevel: "warn",
          fileToRestart: serverAutoreloadFile,
          filesToWatch: serverFiles,
        }
      : {
          enabled: false,
        }),
  })
  const serveFileChangeCallbackList = []
  const clientFileChangeCallbackList = []
  const clientFilesPruneCallbackList = []
  if (autorestartProcess.isPrimary) {
    // TODO: je pense pas que ça marche vu qu'on wrap ça dans directory lifecycle
    // (il faudrait pouvoir passer un truc différement)
    const watchPatterns = {}
    Object.keys(clientFiles).forEach((pattern) => {
      watchPatterns[pattern] = clientFiles[pattern] ? { client: true } : null
    })
    Object.keys(serverFiles).forEach((pattern) => {
      watchPatterns[pattern] = serverFiles[pattern] ? { server: true } : null
    })

    const fileChangeCallback = ({ relativeUrl, event, patternValue }) => {
      const url = new URL(relativeUrl, rootDirectoryUrl).href
      const { client, server } = patternValue
      if (client) {
        clientFileChangeCallbackList.forEach((callback) => {
          callback({ url, event })
        })
      }
      if (server) {
        // do stuff
      }
    }
    const unregisterDirectoryLifecyle = registerDirectoryLifecycle(
      rootDirectoryUrl,
      {
        watchPatterns,
        cooldownBetweenFileEvents,
        keepProcessAlive: false,
        recursive: true,
        added: ({ relativeUrl, patternValue }) => {
          fileChangeCallback({ event: "added", relativeUrl, patternValue })
        },
        updated: ({ relativeUrl, patternValue }) => {
          fileChangeCallback({ event: "modified", relativeUrl, patternValue })
        },
        removed: ({ relativeUrl, patternValue }) => {
          fileChangeCallback({ event: "removed", relativeUrl, patternValue })
        },
      },
    )

    return {
      origin: `${protocol}://127.0.0.1:${port}`,
      stop: () => {
        unregisterDirectoryLifecyle()
        autorestartProcess.stop()
      },
    }
  }

  const logger = createLogger({ logLevel })
  const startServerTask = createTaskLog(logger, "start server")

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
    sourcemaps,
    plugins: [
      ...plugins,
      ...getCorePlugins({
        rootDirectoryUrl,
        urlGraph,
        scenario: "dev",

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
      ...(toolbar ? [jsenvPluginToolbar(toolbar)] : []),
    ],
  })
  const server = await startOmegaServer({
    logger,
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
  startServerTask.done()
  logger.info(``)
  Object.keys(server.origins).forEach((key) => {
    logger.info(`- ${server.origins[key]}`)
  })
  logger.info(``)
  server.addEffect(() => {
    return () => {
      kitchen.pluginController.callHooks("destroy")
    }
  })
  return {
    origin: server.origin,
    stop: server.stop,
  }
}
