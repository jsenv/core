import { requireFromJsenv } from "@jsenv/core/src/require_from_jsenv.js"

// https://github.com/kangax/html-minifier#options-quick-reference
export const minifyHtml = ({ htmlUrlInfo, options } = {}) => {
  const { collapseWhitespace = true, removeComments = true } = options

  const { minify } = requireFromJsenv("html-minifier")
  const htmlMinified = minify(htmlUrlInfo.content, {
    collapseWhitespace,
    removeComments,
  })
  return htmlMinified
}
