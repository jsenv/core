import { jsenvPluginHmr } from "./jsenv_plugin_hmr.js"
import { jsenvPluginHotSSEClient } from "./hot_sse_client/jsenv_plugin_hot_sse_client.js"
import { jsenvPluginHotSSEServer } from "./hot_sse_server/jsenv_plugin_hot_sse_server.js"

export const jsenvPluginAutoreload = ({
  rootDirectoryUrl,
  urlGraph,
  watchedFilePatterns,
  cooldownBetweenFileEvents,
}) => {
  return [
    jsenvPluginHmr(),
    jsenvPluginHotSSEClient(),
    jsenvPluginHotSSEServer({
      rootDirectoryUrl,
      urlGraph,
      watchedFilePatterns,
      cooldownBetweenFileEvents,
    }),
  ]
}
