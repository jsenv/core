import { require } from "internal/require.js"

const { minify } = require("html-minifier")

export const minifyHtml = (htmlString, options) => {
  return minify(htmlString, options)
}
