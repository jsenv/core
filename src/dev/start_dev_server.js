import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import { createUrlGraph } from "@jsenv/utils/url_graph/url_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"
import { getCorePlugins } from "@jsenv/core/src/omega/core_plugins.js"
import { startOmegaServer } from "@jsenv/core/src/omega/server.js"

import { jsenvPluginAutoreload } from "./plugins/autoreload/jsenv_plugin_autoreload.js"
import { jsenvPluginExplorer } from "./plugins/explorer/jsenv_plugin_explorer.js"
import { jsenvPluginToolbar } from "./plugins/toolbar/jsenv_plugin_toolbar.js"

export const startDevServer = async ({
  signal = new AbortController().signal,
  logLevel,
  port,
  protocol,
  // it's better to use http1 by default because it allows to get statusText in devtools
  // which gives valuable information when there is errors
  http2 = false,
  certificate,
  privateKey,

  rootDirectoryUrl,
  plugins = [],

  sourcemaps = "inline",
  autoreload = true,
  autoreloadPatterns = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
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
  const logger = createLogger({ logLevel })
  rootDirectoryUrl = assertAndNormalizeDirectoryUrl(rootDirectoryUrl)
  const urlGraph = createUrlGraph()
  const kitchen = createKitchen({
    signal,
    logger,
    rootDirectoryUrl,
    urlGraph,
    plugins: [
      ...plugins,
      ...getCorePlugins(),
      ...(autoreload
        ? [
            jsenvPluginAutoreload({
              rootDirectoryUrl,
              urlGraph,
              autoreloadPatterns,
            }),
          ]
        : []),
      jsenvPluginExplorer({
        groups: explorerGroups,
      }),
      ...(toolbar ? [jsenvPluginToolbar(toolbar)] : []),
    ],
    scenario: "dev",
    sourcemaps,
  })
  const server = await startOmegaServer({
    logger,
    keepProcessAlive: true,
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
  server.addEffect(() => {
    return () => {
      kitchen.pluginController.callHooks("destroy")
    }
  })
  return server
}
