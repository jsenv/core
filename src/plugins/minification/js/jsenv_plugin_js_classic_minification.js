import { minifyJs } from "./minify_js.js"

export const jsenvPluginJsClassicMinification = (options) => {
  return {
    name: "jsenv:js_classic_minification",
    applidesDuring: {
      build: true,
    },
    optimize: {
      js_module: (urlInfo) => minifyJs(urlInfo, options),
    },
  }
}
