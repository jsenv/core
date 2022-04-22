import { jsenvPluginCssBundling } from "./css/jsenv_plugin_css_bundling.js"
import { jsenvPluginJsClassicWorkersBundling } from "./js_classic_workers/jsenv_plugin_js_classic_workers_bundling.js"
import { jsenvPluginJsModuleBundling } from "./js_module/jsenv_plugin_js_module_bundling.js"

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

  return [
    ...(bundling.css ? [jsenvPluginCssBundling(bundling.css)] : []),
    ...(bundling.js_classic_workers
      ? [jsenvPluginJsClassicWorkersBundling(bundling.js_classic_workers)]
      : []),
    ...(bundling.js_module
      ? [jsenvPluginJsModuleBundling(bundling.js_module)]
      : []),
  ]
}
