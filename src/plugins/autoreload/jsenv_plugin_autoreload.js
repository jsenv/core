import { jsenvPluginAutoreloadClient } from "./jsenv_plugin_autoreload_client.js";
import { jsenvPluginAutoreloadServer } from "./jsenv_plugin_autoreload_server.js";
import { jsenvPluginHotSearchParam } from "./jsenv_plugin_hot_search_param.js";

export const jsenvPluginAutoreload = ({
  clientFileChangeEventEmitter,
  clientFileDereferencedEventEmitter,
}) => {
  return [
    jsenvPluginHotSearchParam(),
    jsenvPluginAutoreloadClient(),
    jsenvPluginAutoreloadServer({
      clientFileChangeEventEmitter,
      clientFileDereferencedEventEmitter,
    }),
  ];
};
