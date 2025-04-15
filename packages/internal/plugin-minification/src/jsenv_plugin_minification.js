import { minifyCss } from "./css/css_minification.js";
import { minifyHtml } from "./html/html_minification.js";
import { minifyJs } from "./js/js_minification.js";
import { stripJsComments } from "./js/js_strip_comments.js";
import { minifyJson } from "./json/json_minification.js";

export const jsenvPluginMinification = (options) => {
  if (options === false) {
    options = {
      html: null,
      css: null,
      js_classic: null,
      js_module: null,
      json: null,
      svg: null,
    };
  }
  const {
    html = {},
    css = {},
    js_classic = {},
    js_module = {},
    json = {},
    svg = {},
  } = options;
  const htmlMinifier = html
    ? (urlInfo) => minifyHtml(urlInfo, html === true ? {} : html)
    : null;
  const svgMinifier = svg
    ? (urlInfo) => minifyHtml(urlInfo, svg === true ? {} : svg)
    : null;
  const cssMinifier = css
    ? (urlInfo) => minifyCss(urlInfo, css === true ? {} : css)
    : null;
  const jsClassicMinifier = js_classic
    ? (urlInfo) => minifyJs(urlInfo, js_classic === true ? {} : js_classic)
    : null;
  const jsModuleMinifier = js_module
    ? (urlInfo) => minifyJs(urlInfo, js_module === true ? {} : js_module)
    : (urlInfo) => stripJsComments(urlInfo);
  const jsonMinifier = json
    ? (urlInfo) => minifyJson(urlInfo, json === true ? {} : html)
    : null;

  return {
    name: "jsenv:minification",
    appliesDuring: "build",
    meta: {
      willMinifyHtml: Boolean(html),
      willMinifySvg: Boolean(svg),
      willMinifyCss: Boolean(css),
      willMinifyJsClassic: Boolean(js_classic),
      willMinifyJsModule: Boolean(js_module),
      willMinifyJson: Boolean(json),
    },
    optimizeBuildUrlContent: {
      html: htmlMinifier,
      svg: svgMinifier,
      css: cssMinifier,
      js_classic: jsClassicMinifier,
      js_module: jsModuleMinifier,
      json: jsonMinifier,
      importmap: jsonMinifier,
      webmanifest: jsonMinifier,
    },
  };
};
