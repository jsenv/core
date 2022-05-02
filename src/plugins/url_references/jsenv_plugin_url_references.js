import { parseAndTransformHtmlUrls } from "./html/html_urls.js"
import { parseAndTransformCssUrls } from "./css/css_urls.js"
import { parseAndTransformJsUrls } from "./js/js_urls.js"
import { parseAndTransformWebmanifestUrls } from "./webmanifest/webmanifest_urls.js"

export const jsenvPluginUrlReferences = () => {
  return {
    name: "jsenv:url_references",
    appliesDuring: "*",
    transformUrlContent: {
      html: parseAndTransformHtmlUrls,
      css: parseAndTransformCssUrls,
      js_classic: parseAndTransformJsUrls,
      js_module: parseAndTransformJsUrls,
      webmanifest: parseAndTransformWebmanifestUrls,
    },
  }
}
