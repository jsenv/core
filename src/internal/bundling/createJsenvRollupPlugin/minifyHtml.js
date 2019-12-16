const { minify } = import.meta.require("html-minifier")

export const minifyHtml = (htmlString, options) => {
  return minify(htmlString, options)
}
