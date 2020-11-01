import { minify } from "terser"

// https://github.com/terser-js/terser#minify-options
export const minifyJs = async (jsString, jsUrl, options) => {
  const result = await minify({ [jsUrl]: jsString }, options)
  return result
}
