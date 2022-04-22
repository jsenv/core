import { jsenvPluginHtmlMinification } from "./html/jsenv_plugin_html_minification.js"
import { jsenvPluginCssMinification } from "./css/jsenv_plugin_css_minification.js"
import { jsenvPluginJsClassicMinification } from "./js/jsenv_plugin_js_classic_minification.js"
import { jsenvPluginJsModuleMinification } from "./js/jsenv_plugin_js_module_minification.js"
import { jsenvPluginJsonMinification } from "./json/jsenv_plugin_json_minification.js"

export const jsenvPluginMinification = (minification) => {
  if (typeof minification === "boolean") {
    minification = {
      html: minification,
      css: minification,
      js: minification,
      json: minification,
      svg: minification,
    }
  } else if (typeof minification !== "object") {
    throw new Error(
      `minification must be a boolean or an object, got ${minification}`,
    )
  }
  Object.keys(minification).forEach((key) => {
    if (minification[key] === true) minification[key] = {}
  })
  return [
    ...(minification.html
      ? [jsenvPluginHtmlMinification(minification.html)]
      : []),
    ...(minification.css ? [jsenvPluginCssMinification(minification.css)] : []),
    ...(minification.js_classic
      ? [jsenvPluginJsClassicMinification(minification.js_module)]
      : []),
    ...(minification.js_module
      ? [jsenvPluginJsModuleMinification(minification.js_classic)]
      : []),
    ...(minification.json
      ? [jsenvPluginJsonMinification(minification.json)]
      : []),
  ]
}
