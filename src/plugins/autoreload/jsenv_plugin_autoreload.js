import { jsenvPluginHmr } from "./jsenv_plugin_hmr.js"
import { jsenvPluginAutoreloadClient } from "./jsenv_plugin_autoreload_client.js"
import { jsenvPluginAutoreloadServer } from "./jsenv_plugin_autoreload_server.js"

export const jsenvPluginAutoreload = ({
  scenario,
  clientFileChangeCallbackList,
  clientFilesPruneCallbackList,
}) => {
  if (scenario === "build") {
    return []
  }
  return [
    jsenvPluginHmr(),
    jsenvPluginAutoreloadClient(),
    jsenvPluginAutoreloadServer({
      clientFileChangeCallbackList,
      clientFilesPruneCallbackList,
    }),
  ]
}
