import { jsenvPluginInliningAsDataUrl } from "./jsenv_plugin_inlining_as_data_url.js";
import { jsenvPluginInliningIntoHtml } from "./jsenv_plugin_inlining_into_html.js";

export const jsenvPluginInlining = () => {
  return [jsenvPluginInliningAsDataUrl(), jsenvPluginInliningIntoHtml()];
};
