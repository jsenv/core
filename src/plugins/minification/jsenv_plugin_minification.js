import { minifyHtml } from "./html/minify_html.js"
import { minifyCss } from "./css/minify_css.js"
import { minifyJs } from "./js/minify_js.js"
import { minifyJson } from "./json/minify_json.js"

export const jsenvPluginMinification = (minification) => {
  if (typeof minification === "boolean") {
    minification = {
      html: minification,
      css: minification,
      js_classic: minification,
      js_module: minification,
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
  const htmlOptimizer = minification.html
    ? (urlInfo, context) =>
        minifyHtml({
          htmlUrlInfo: urlInfo,
          context,
          options: minification.html,
        })
    : null
  const jsonOptimizer = minification.json
    ? (urlInfo, context) =>
        minifyJson({
          jsonUrlInfo: urlInfo,
          context,
          options: minification.json,
        })
    : null
  const cssOptimizer = minification.css
    ? (urlInfo, context) =>
        minifyCss({
          cssUrlInfo: urlInfo,
          context,
          options: minification.css,
        })
    : null
  const jsClassicOptimizer = minification.js_classic
    ? (urlInfo, context) =>
        minifyJs({
          jsUrlInfo: urlInfo,
          context,
          options: minification.js_classic,
        })
    : null
  const jsModuleOptimizer = minification.js_module
    ? (urlInfo, context) =>
        minifyJs({
          jsUrlInfo: urlInfo,
          context,
          options: minification.js_module,
        })
    : null

  return {
    name: "jsenv:minification",
    appliesDuring: "build",
    optimizeUrlContent: {
      html: htmlOptimizer,
      svg: htmlOptimizer,
      css: cssOptimizer,
      js_classic: jsClassicOptimizer,
      js_module: jsModuleOptimizer,
      json: jsonOptimizer,
      importmap: jsonOptimizer,
      webmanifest: jsonOptimizer,
    },
  }
}
