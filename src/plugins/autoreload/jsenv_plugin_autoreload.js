import { jsenvPluginHmr } from "./jsenv_plugin_hmr.js"
import { jsenvPluginDevSSEClient } from "./dev_sse/jsenv_plugin_dev_sse_client.js"
import { jsenvPluginDevSSEServer } from "./dev_sse/jsenv_plugin_dev_sse_server.js"

export const jsenvPluginAutoreload = ({
  rootDirectoryUrl,
  urlGraph,
  scenario,
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList,
}) => {
  if (scenario === "build") {
    return []
  }
  return [
    jsenvPluginHmr(),
    jsenvPluginDevSSEClient(),
    jsenvPluginDevSSEServer({
      rootDirectoryUrl,
      urlGraph,
      clientFileChangeCallbackList,
      clientFilesPruneCallbackList,
    }),
  ]
}
