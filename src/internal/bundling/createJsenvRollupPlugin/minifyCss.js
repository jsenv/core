import { require } from "internal/require.js"

const CleanCSS = require("clean-css")

export const minifyCss = (cssString, options) => {
  return new CleanCSS(options).minify(cssString).styles
}
