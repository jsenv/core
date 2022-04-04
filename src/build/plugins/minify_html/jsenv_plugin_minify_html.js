import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

// https://github.com/kangax/html-minifier#options-quick-reference
export const jsenvPluginMinifyHtml = ({
  collapseWhitespace = true,
  removeComments = true,
} = {}) => {
  return {
    name: "jsenv:minify_html",
    appliesDuring: {
      build: true,
    },
    optimize: {
      html: async (htmlUrlInfo) => {
        return minifyHtml(htmlUrlInfo.content, {
          collapseWhitespace,
          removeComments,
        })
      },
    },
  }
}

const minifyHtml = (htmlString, options) => {
  const { minify } = require("html-minifier")
  const htmlMinified = minify(htmlString, options)
  return htmlMinified
}
