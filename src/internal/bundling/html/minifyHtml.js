import { require } from "@jsenv/core/src/internal/require.js"

export const minifyHtml = (htmlString, options) => {
  const { minify } = require("html-minifier")
  return minify(htmlString, options)
}
