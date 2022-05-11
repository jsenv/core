import { jsenvPluginHmr } from "./jsenv_plugin_hmr.js"
import { jsenvPluginDevSSEClient } from "./dev_sse/jsenv_plugin_dev_sse_client.js"
import { jsenvPluginDevSSEServer } from "./dev_sse/jsenv_plugin_dev_sse_server.js"

export const jsenvPluginAutoreload = ({
  rootDirectoryUrl,
  urlGraph,
  scenario,
  watchedFilePatterns = {
    "./**": true,
    "./**/.*/": false, // any folder starting with a dot is ignored (includes .git for instance)
    "./dist/": false,
    "./**/node_modules/": false,
  },
  cooldownBetweenFileEvents = 0,
}) => {
  if (scenario === "build") {
    // TODO
    return []
  }
  return [
    jsenvPluginHmr(),
    jsenvPluginDevSSEClient(),
    jsenvPluginDevSSEServer({
      rootDirectoryUrl,
      urlGraph,
      watchedFilePatterns,
      cooldownBetweenFileEvents,
    }),
  ]
}
