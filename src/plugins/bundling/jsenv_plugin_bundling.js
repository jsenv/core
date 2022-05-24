import { bundleCss } from "./css/bundle_css.js"
import { bundleJsClassicWorkers } from "./js_classic_workers/bundle_js_classic_workers.js"
import { bundleJsModule } from "./js_module/bundle_js_module.js"

export const jsenvPluginBundling = (bundling) => {
  if (typeof bundling === "boolean") {
    bundling = {
      css: bundling,
      js_classic_workers: bundling,
      js_module: bundling,
    }
  } else if (typeof bundling !== "object") {
    throw new Error(`bundling must be a boolean or an object, got ${bundling}`)
  }
  Object.keys(bundling).forEach((key) => {
    if (bundling[key] === true) bundling[key] = {}
  })

  return {
    name: "jsenv:bundling",
    appliesDuring: {
      build: true,
    },
    bundle: {
      css: bundling.css
        ? (cssUrlInfos, context) => {
            return bundleCss({
              cssUrlInfos,
              context,
              options: bundling.css,
            })
          }
        : undefined,
      js_classic: bundling.js_classic
        ? (jsClassicUrlInfos, context) => {
            return bundleJsClassicWorkers({
              jsClassicUrlInfos,
              context,
              options: bundling.js_classic_workers,
            })
          }
        : undefined,
      js_module: bundling.js_module
        ? (jsModuleUrlInfos, context) => {
            return bundleJsModule({
              jsModuleUrlInfos,
              context,
              options: bundling.js_module,
            })
          }
        : undefined,
    },
  }
}
