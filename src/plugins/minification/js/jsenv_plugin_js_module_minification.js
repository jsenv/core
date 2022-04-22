import { minifyJs } from "./minify_js.js"

export const jsenvPluginJsModuleMinification = (options) => {
  return {
    name: "jsenv:js_module_minification",
    applidesDuring: {
      build: true,
    },
    optimize: {
      js_module: (urlInfo) => minifyJs(urlInfo, options),
    },
  }
}
