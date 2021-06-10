export const minifyJs = async (jsString, jsUrl, options) => {
  // https://github.com/terser-js/terser#minify-options
  const { minify } = await import("terser")
  const result = await minify({ [jsUrl]: jsString }, options)
  return result
}
