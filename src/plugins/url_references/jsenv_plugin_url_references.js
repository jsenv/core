// this plugin should be split in 2:
// 1: use es-module-lexer for js_modules imports
// 2: use babel to parse js_classic and the remaining urls that might be found
// in js_modules (new URL, new Worker, ...)

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
