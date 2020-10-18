import { urlToFileSystemPath } from "@jsenv/util"
import { require } from "@jsenv/core/src/internal/require.js"

const postcss = require("postcss")

export const applyPostCss = async (cssString, cssUrl, plugins, options = {}) => {
  let result
  try {
    const cssFileUrl = urlToFileUrl(cssUrl)
    result = await postcss(plugins).process(cssString, {
      collectUrls: true,
      from: urlToFileSystemPath(cssFileUrl),
      to: urlToFileSystemPath(cssFileUrl),
      ...options,
    })
  } catch (error) {
    if (error.name === "CssSyntaxError") {
      console.error(String(error))
      throw error
    }
    throw error
  }
  return result
}

const urlToFileUrl = (url) => {
  if (url.startsWith("file:///")) {
    return url
  }
  const origin = new URL(url).origin
  const afterOrigin = url.slice(origin.length)
  return `file://${afterOrigin}`
}
