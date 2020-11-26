import { require } from "@jsenv/core/src/internal/require.js"

// https://github.com/terser-js/terser#minify-options
export const minifyJs = async (jsString, jsUrl, options) => {
  const { minify } = require("terser")
  const result = await minify({ [jsUrl]: jsString }, options)
  return result
}
