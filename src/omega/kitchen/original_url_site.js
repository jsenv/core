// maybe move this to sourcemap utils

import { getOriginalPosition } from "@jsenv/core/src/utils/sourcemap/original_position.js"

export const getOriginalUrlSite = async ({
  originalUrl,
  originalContent,
  originalLine,
  originalColumn,
  ownerUrl,
  ownerLine,
  ownerColumn,
  ownerContent,
  url,
  content,
  line,
  column,
  sourcemap,
}) => {
  const adjustIfInline = ({ url, content, line, column }) => {
    if (ownerUrl) {
      return {
        url: ownerUrl,
        line: ownerLine + line,
        column: ownerColumn + column,
        content: ownerContent,
      }
    }
    return {
      url,
      content,
      line,
      column,
    }
  }
  if (typeof originalLine === "number") {
    return adjustIfInline({
      url: originalUrl,
      content: originalContent,
      line: originalLine,
      column: originalColumn,
    })
  }
  // content not modified, we can return the line+column
  if (content === originalContent) {
    return adjustIfInline({
      url: originalUrl,
      content,
      line,
      column,
    })
  }
  // no sourcemap, we cannot point to the original file, use the transformed url+line+column
  if (!sourcemap) {
    return {
      url,
      line,
      column,
    }
  }
  const originalPosition = await getOriginalPosition({
    sourcemap,
    line,
    column,
  })
  // cannot map back to original file
  if (!originalPosition || originalPosition.line === null) {
    return {
      url,
      line,
      column,
    }
  }
  return adjustIfInline({
    url: originalUrl,
    content: originalContent,
    line: originalPosition.line,
    column: originalPosition.column,
  })
}
