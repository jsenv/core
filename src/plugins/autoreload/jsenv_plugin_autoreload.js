import { jsenvPluginHmr } from "./jsenv_plugin_hmr.js"
import { jsenvPluginHot } from "./jsenv_plugin_hot.js"
import { jsenvPluginHotSSE } from "./jsenv_plugin_hot_sse.js"

export const jsenvPluginAutoreload = ({
  rootDirectoryUrl,
  urlGraph,
  watchedFilePatterns,
  cooldownBetweenFileEvents,
}) => {
  return [
    jsenvPluginHmr(),
    jsenvPluginHot(),
    jsenvPluginHotSSE({
      rootDirectoryUrl,
      urlGraph,
      watchedFilePatterns,
      cooldownBetweenFileEvents,
    }),
  ]
}
