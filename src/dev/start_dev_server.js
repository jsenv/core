import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
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
  logLevel,
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

  sourcemaps = "inline",
  plugins = [],
  htmlSupervisor = true,
  injectedGlobals,
  nodeEsmResolution,
  fileSystemMagicResolution,
  transpilation,
  autoreload = true,
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
  autorestart,
}) => {
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  const autorestartProcess = await initProcessAutorestart({
    signal,
    handleSIGINT,
    ...(autorestart
      ? {
          enabled: true,
          logLevel: autorestart.logLevel,
          urlToRestart: autorestart.url,
          urlsToWatch: [
            ...(autorestart.urlsToWatch || []),
            new URL("package.json", rootDirectoryUrl),
            new URL("jsenv.config.mjs", rootDirectoryUrl),
          ],
        }
      : {
          enabled: false,
        }),
  })
  if (autorestartProcess.isPrimary) {
    return {
      origin: `${protocol}://127.0.0.1:${port}`,
      stop: () => {
        autorestartProcess.stop()
      },
    }
  }

  const logger = createLogger({ logLevel })
  const startServerTask = createTaskLog(logger, "start server")

  const urlGraph = createUrlGraph()
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
        autoreload,
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
