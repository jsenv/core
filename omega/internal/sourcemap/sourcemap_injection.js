import { urlToRelativeUrl } from "@jsenv/filesystem"

import {
  setJavaScriptSourceMappingUrl,
  setCssSourceMappingUrl,
  sourcemapToBase64Url,
} from "./sourcemap_utils.js"

export const injectSourcemap = ({
  url,
  contentType,
  content,
  sourcemap,
  sourcemapUrl,
  sourcemapInjectionMethod,
}) => {
  if (contentType === "application/javascript") {
    if (sourcemapInjectionMethod === "comment") {
      return setJavaScriptSourceMappingUrl(
        content,
        urlToRelativeUrl(sourcemapUrl, url),
      )
    }
    if (sourcemapInjectionMethod === "inline") {
      return setJavaScriptSourceMappingUrl(
        content,
        sourcemapToBase64Url(sourcemap),
      )
    }
    return content
  }
  if (contentType === "text/css") {
    if (sourcemapInjectionMethod === "comment") {
      return setCssSourceMappingUrl(
        content,
        urlToRelativeUrl(sourcemapUrl, url),
      )
    }
    if (sourcemapInjectionMethod === "inline") {
      return setCssSourceMappingUrl(content, sourcemapToBase64Url(sourcemap))
    }
  }
  return content
}
