import { parseAndTransformHtmlUrls } from "./html/html_urls.js"
import { parseAndTransformCssUrls } from "./css/css_urls.js"
import { parseAndTransformJsUrls } from "./js/js_urls.js"
import { parseAndTransformWebmanifestUrls } from "./webmanifest/webmanifest_urls.js"

export const jsenvPluginUrlAnalysis = () => {
  return {
    name: "jsenv:url_analysis",
    appliesDuring: "*",
    redirectUrl: (reference) => {
      if (reference.specifier[0] === "#") {
        return
      }
      if (reference.url.startsWith("data:")) {
        reference.shouldHandle = true
        return
      }
      if (reference.url.startsWith("file:")) {
        reference.shouldHandle = true
        return
      }
    },
    transformUrlContent: {
      html: parseAndTransformHtmlUrls,
      css: parseAndTransformCssUrls,
      js_classic: parseAndTransformJsUrls,
      js_module: parseAndTransformJsUrls,
      webmanifest: parseAndTransformWebmanifestUrls,
    },
  }
}
