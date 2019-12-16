const CleanCSS = import.meta.require("clean-css")

export const minifyCss = (cssString, options) => {
  return new CleanCSS(options).minify(cssString).styles
}
