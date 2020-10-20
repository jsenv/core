import { require } from "@jsenv/core/src/internal/require.js"

const { minify } = require("terser")

// https://github.com/terser-js/terser#minify-options
export const minifyJs = async (jsString, jsUrl, options) => {
  const result = await minify({ [jsUrl]: jsString }, options)
  return result
}
