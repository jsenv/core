import { require } from "../../require.js"

const { minify } = require("terser")

export const minifyJs = (jsString, options) => {
  return minify(jsString, options)
}
