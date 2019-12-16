const { minify } = import.meta.require("terser")

export const minifyJs = (jsString, options) => {
  return minify(jsString, options)
}
