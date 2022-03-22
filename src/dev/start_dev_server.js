import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
import { createLogger } from "@jsenv/logger"

import { createUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph.js"
import { createKitchen } from "@jsenv/core/src/omega/kitchen/kitchen.js"
import { getJsenvPlugins } from "@jsenv/core/src/omega/jsenv_plugins.js"
import { startOmegaServer } from "@jsenv/core/src/omega/server.js"

import { jsenvPluginAutoreload } from "./plugins/autoreload/jsenv_plugin_autoreload.js"

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

  sourcemapMethod = "inline",
  autoreload = true,
  autoreloadPatterns = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
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
      ...getJsenvPlugins(),
      ...(autoreload
        ? [
            jsenvPluginAutoreload({
              rootDirectoryUrl,
              urlGraph,
              autoreloadPatterns,
            }),
          ]
        : []),
    ],
    scenario: "dev",
    sourcemapMethod,
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
