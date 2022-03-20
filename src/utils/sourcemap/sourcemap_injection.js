import { urlToRelativeUrl } from "@jsenv/filesystem"

import {
  setJavaScriptSourceMappingUrl,
  setCssSourceMappingUrl,
  sourcemapToBase64Url,
} from "./sourcemap_utils.js"

export const injectSourcemap = (
  { url, contentType, content, sourcemap, sourcemapUrl },
  { sourcemapMethod },
) => {
  if (contentType === "application/javascript") {
    if (sourcemapMethod === "file") {
      return setJavaScriptSourceMappingUrl(
        content,
        urlToRelativeUrl(sourcemapUrl, url),
      )
    }
    if (sourcemapMethod === "inline") {
      return setJavaScriptSourceMappingUrl(
        content,
        sourcemapToBase64Url(sourcemap),
      )
    }
    return content
  }
  if (contentType === "text/css") {
    if (sourcemapMethod === "file") {
      return setCssSourceMappingUrl(
        content,
        urlToRelativeUrl(sourcemapUrl, url),
      )
    }
    if (sourcemapMethod === "inline") {
      return setCssSourceMappingUrl(content, sourcemapToBase64Url(sourcemap))
    }
  }
  return content
}
