import { normalizeStructuredMetaMap, urlToMeta } from "@jsenv/filesystem"

import { parseAndTransformHtmlUrls } from "./html/html_urls.js"
import { parseAndTransformCssUrls } from "./css/css_urls.js"
import { parseAndTransformJsUrls } from "./js/js_urls.js"
import { parseAndTransformWebmanifestUrls } from "./webmanifest/webmanifest_urls.js"

export const jsenvPluginUrlAnalysis = ({ rootDirectoryUrl, include }) => {
  let getIncludeInfo = () => undefined
  if (include) {
    const includeMetaMap = normalizeStructuredMetaMap(
      {
        include,
      },
      rootDirectoryUrl,
    )
    getIncludeInfo = (url) => {
      const meta = urlToMeta({
        url,
        structuredMetaMap: includeMetaMap,
      })
      return meta.include
    }
  }

  return {
    name: "jsenv:url_analysis",
    appliesDuring: "*",
    redirectUrl: (reference) => {
      if (reference.specifier[0] === "#") {
        reference.shouldHandle = false
        return
      }
      const includeInfo = getIncludeInfo(reference.url)
      if (includeInfo === true) {
        reference.shouldHandle = true
        return
      }
      if (includeInfo === false) {
        reference.shouldHandle = false
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
