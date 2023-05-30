import { minifyHtml } from "./html/html_minification.js";
import { minifyCss } from "./css/css_minification.js";
import { minifyJs } from "./js/js_minification.js";
import { minifyJson } from "./json/json_minification.js";

export const jsenvPluginMinification = ({
  html = {},
  css = {},
  js_classic = {},
  js_module = {},
  json = {},
  svg = {},
} = {}) => {
  const htmlMinifier = html
    ? (urlInfo, context) =>
        minifyHtml({
          htmlUrlInfo: urlInfo,
          context,
          options: html === true ? {} : html,
        })
    : null;
  const svgMinifier = svg
    ? (urlInfo, context) =>
        minifyHtml({
          htmlUrlInfo: urlInfo,
          context,
          options: svg === true ? {} : svg,
        })
    : null;
  const cssMinifier = css
    ? (urlInfo, context) =>
        minifyCss({
          cssUrlInfo: urlInfo,
          context,
          options: css === true ? {} : css,
        })
    : null;
  const jsClassicMinifier = js_classic
    ? (urlInfo, context) =>
        minifyJs({
          jsUrlInfo: urlInfo,
          context,
          options: js_classic === true ? {} : js_classic,
        })
    : null;
  const jsModuleMinifier = js_module
    ? (urlInfo, context) =>
        minifyJs({
          jsUrlInfo: urlInfo,
          context,
          options: js_module === true ? {} : js_module,
        })
    : null;
  const jsonMinifier = json
    ? (urlInfo, context) =>
        minifyJson({
          jsonUrlInfo: urlInfo,
          context,
          options: json === true ? {} : html,
        })
    : null;

  return {
    name: "jsenv:minification",
    appliesDuring: "build",
    optimizeUrlContent: {
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
