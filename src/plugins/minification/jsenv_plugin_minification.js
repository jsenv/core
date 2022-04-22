import { minifyHtml } from "./html/minify_html.js"
import { minifyCss } from "./css/minify_css.js"
import { minifyJs } from "./js/minify_js.js"
import { minifyJson } from "./json/minify_json.js"

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

  return {
    name: "jsenv:minification",
    appliesDuring: {
      build: true,
    },
    optimize: {
      html: htmlOptimizer,
      svg: htmlOptimizer,
      css: minification.css
        ? (urlInfo, context) =>
            minifyCss({
              cssUrlInfo: urlInfo,
              context,
              options: minification.css,
            })
        : null,
      js_classic: minification.js_classic
        ? (urlInfo, context) =>
            minifyJs({
              jsUrlInfo: urlInfo,
              context,
              options: minification.js_classic,
            })
        : null,
      js_module: minification.js_module
        ? (urlInfo, context) =>
            minifyJs({
              jsUrlInfo: urlInfo,
              context,
              options: minification.js_module,
            })
        : null,
      json: jsonOptimizer,
      importmap: jsonOptimizer,
      webmanifest: jsonOptimizer,
    },
  }
}
