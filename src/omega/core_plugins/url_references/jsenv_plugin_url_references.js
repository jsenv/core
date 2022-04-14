import { parseAndTransformHtmlUrls } from "./html_urls.js"
import { parseAndTransformCssUrls } from "./css_urls.js"
import { parseAndTransformJsClassicUrls } from "./js_classic_urls.js"
import { parseAndTransformJsModuleUrls } from "./js_module_urls.js"

export const jsenvPluginUrlReferences = () => {
  return {
    name: "jsenv:url_references",
    appliesDuring: "*",
    transform: {
      html: parseAndTransformHtmlUrls,
      css: parseAndTransformCssUrls,
      js_classic: parseAndTransformJsClassicUrls,
      js_module: parseAndTransformJsModuleUrls,
    },
  }
}
