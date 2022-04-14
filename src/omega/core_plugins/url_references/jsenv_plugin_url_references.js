import { jsenvPluginJsModuleAsJsClassic } from "../js_module_as_js_classic/jsenv_plugin_js_module_as_js_classic.js"
import { parseAndTransformHtmlUrls } from "./html_urls.js"
import { parseAndTransformCssUrls } from "./css_urls.js"
import { parseAndTransformJsUrls } from "./js_urls.js"

export const jsenvPluginUrlReferences = () => {
  return [
    {
      name: "jsenv:url_references",
      appliesDuring: "*",
      transform: {
        html: parseAndTransformHtmlUrls,
        css: parseAndTransformCssUrls,
        js_classic: parseAndTransformJsUrls,
        js_module: parseAndTransformJsUrls,
      },
    },
    jsenvPluginJsModuleAsJsClassic(),
  ]
}
