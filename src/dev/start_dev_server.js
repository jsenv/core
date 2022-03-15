import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"
import { createCallbackList } from "@jsenv/abort"
import { createLogger } from "@jsenv/logger"

import { createUrlGraph } from "@jsenv/core/src/utils/url_graph/url_graph.js"
import { createPluginController } from "@jsenv/core/src/omega/kitchen/plugin_controller.js"
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

  projectDirectoryUrl,
  plugins = [],

  sourcemapInjection = "inline",
  autoreloadPatterns = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
}) => {
  const logger = createLogger({ logLevel })
  projectDirectoryUrl = assertAndNormalizeDirectoryUrl(projectDirectoryUrl)
  const urlGraph = createUrlGraph({
    rootDirectoryUrl: projectDirectoryUrl,
  })
  const stopCallbackList = createCallbackList()
  const pluginController = createPluginController({
    plugins: [
      ...plugins,
      ...getJsenvPlugins(),
      jsenvPluginAutoreload({
        stopCallbackList,
        rootDirectoryUrl: projectDirectoryUrl,
        urlGraph,
        autoreloadPatterns,
      }),
    ],
    scenario: "dev",
  })
  const kitchen = createKitchen({
    signal,
    logger,
    rootDirectoryUrl: projectDirectoryUrl,
    urlGraph,
    scenario: "dev",
    pluginController,
    sourcemapInjection,
  })
  const server = await startOmegaServer({
    keepProcessAlive: true,
    port,
    protocol,
    http2,
    certificate,
    privateKey,
    projectDirectoryUrl,
    pluginController,
    kitchen,
    scenario: "dev",
  })
  server.addEffect(() => {
    return () => {
      stopCallbackList.notify()
    }
  })
  return server
}
