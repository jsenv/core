import { urlToRelativeUrl } from "@jsenv/filesystem"

import {
  setJavaScriptSourceMappingUrl,
  setCssSourceMappingUrl,
  sourcemapToBase64Url,
} from "./sourcemap_utils.js"

export const injectSourcemap = (
  { url, contentType, content, sourcemap, sourcemapUrl },
  { sourcemapInjection },
) => {
  if (contentType === "application/javascript") {
    if (sourcemapInjection === "comment") {
      return setJavaScriptSourceMappingUrl(
        content,
        urlToRelativeUrl(sourcemapUrl, url),
      )
    }
    if (sourcemapInjection === "inline") {
      return setJavaScriptSourceMappingUrl(
        content,
        sourcemapToBase64Url(sourcemap),
      )
    }
    return content
  }
  if (contentType === "text/css") {
    if (sourcemapInjection === "comment") {
      return setCssSourceMappingUrl(
        content,
        urlToRelativeUrl(sourcemapUrl, url),
      )
    }
    if (sourcemapInjection === "inline") {
      return setCssSourceMappingUrl(content, sourcemapToBase64Url(sourcemap))
    }
  }
  return content
}
