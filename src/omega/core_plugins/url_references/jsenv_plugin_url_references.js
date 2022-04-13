import { parseAndTransformHtmlUrls } from "./html_urls.js"
import { parseAndTransformCssUrls } from "./css_urls.js"
import { parseAndTransformWorkerClassicUrls } from "./worker_classic_urls.js"
import { parseAndTransformJsModuleUrls } from "./js_module_urls.js"

export const jsenvPluginUrlReferences = () => {
  return {
    name: "jsenv:url_references",
    appliesDuring: "*",
    transform: {
      html: parseAndTransformHtmlUrls,
      css: parseAndTransformCssUrls,
      js_classic: (urlInfo, context) => {
        if (
          urlInfo.subtype === "worker" ||
          urlInfo.subtype === "service_worker"
        ) {
          return parseAndTransformWorkerClassicUrls(urlInfo, context)
        }
        return null
      },
      js_module: parseAndTransformJsModuleUrls,
    },
  }
}
