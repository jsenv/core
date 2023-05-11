import { jsenvPluginInliningAsDataUrl } from "./jsenv_plugin_inlining_as_data_url.js";
import { jsenvPluginInliningIntoHtml } from "./jsenv_plugin_inlining_into_html.js";

export const jsenvPluginInlining = () => {
  return [
    {
      name: "jsenv:inlining",
      appliesDuring: "*",
      redirectUrl: (reference) => {
        const { searchParams } = reference;
        if (searchParams.has("inline")) {
          const urlObject = new URL(reference.url);
          urlObject.searchParams.delete("inline");
          return urlObject.href;
        }
        return null;
      },
    },
    jsenvPluginInliningAsDataUrl(),
    jsenvPluginInliningIntoHtml(),
  ];
};
