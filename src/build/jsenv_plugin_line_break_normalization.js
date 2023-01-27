import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"

import { ensureUnixLineBreaks } from "./line_break_unix.js"

export const jsenvPluginLineBreakNormalization = () => {
  return {
    name: "jsenv:line_break_normalizer",
    appliesDuring: "build",
    transformUrlContent: (urlInfo) => {
      if (CONTENT_TYPE.isTextual(urlInfo.contentType)) {
        return ensureUnixLineBreaks(urlInfo.content)
      }
      return null
    },
  }
}
