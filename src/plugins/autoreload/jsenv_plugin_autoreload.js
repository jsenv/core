import { jsenvPluginHmr } from "./jsenv_plugin_hmr.js"
import { jsenvPluginSSEClient } from "./sse_client/jsenv_plugin_sse_client.js"
import { jsenvPluginSSEServer } from "./sse_server/jsenv_plugin_sse_server.js"

export const jsenvPluginAutoreload = ({
  rootDirectoryUrl,
  urlGraph,
  watchedFilePatterns,
  cooldownBetweenFileEvents,
}) => {
  return [
    jsenvPluginHmr(),
    jsenvPluginSSEClient(),
    jsenvPluginSSEServer({
      rootDirectoryUrl,
      urlGraph,
      watchedFilePatterns,
      cooldownBetweenFileEvents,
    }),
  ]
}
