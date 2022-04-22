import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

// https://github.com/kangax/html-minifier#options-quick-reference
export const minifyHtml = ({ htmlUrlInfo, options } = {}) => {
  const { collapseWhitespace = true, removeComments = true } = options

  const { minify } = require("html-minifier")
  const htmlMinified = minify(htmlUrlInfo.content, {
    collapseWhitespace,
    removeComments,
  })
  return htmlMinified
}
