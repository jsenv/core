import { bundleCss } from "./css/css_bundling_lightning_css.js"
import { bundleJsClassicWorkers } from "./js_classic_workers/bundle_js_classic_workers.js"
import { bundleJsModules } from "./js_module/bundle_js_modules.js"

export const jsenvPluginBundling = ({
  css = {},
  js_classic = {},
  js_module = {},
} = {}) => {
  return {
    name: "jsenv:bundling",
    appliesDuring: "build",
    bundle: {
      css: css
        ? (cssUrlInfos, context) => {
            return bundleCss({
              cssUrlInfos,
              context,
              options: css === true ? {} : css,
            })
          }
        : undefined,
      js_classic: js_classic
        ? (jsClassicUrlInfos, context) => {
            return bundleJsClassicWorkers({
              jsClassicUrlInfos,
              context,
              options: js_classic === true ? {} : js_classic,
            })
          }
        : undefined,
      js_module: js_module
        ? (jsModuleUrlInfos, context) => {
            return bundleJsModules({
              jsModuleUrlInfos,
              context,
              options: js_module === true ? {} : js_module,
            })
          }
        : undefined,
    },
  }
}
