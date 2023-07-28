// html
export {
  parseHtmlString,
  stringifyHtmlAst,
  parseSvgString,
  stringifySvgAst,
} from "./html/html_parse.js";
export { visitHtmlNodes, findHtmlNode } from "./html/html_search.js";
export { analyzeScriptNode, analyzeLinkNode } from "./html/html_analysis.js";
export {
  getHtmlNodeText,
  removeHtmlNodeText,
  setHtmlNodeText,
} from "./html/html_node_text.js";
export { parseSrcSet, stringifySrcSet } from "./html/html_src_set.js";
export {
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
} from "./html/html_node_attributes.js";
export {
  removeHtmlNode,
  createHtmlNode,
  injectHtmlNode,
  injectHtmlNodeAsEarlyAsPossible,
  insertHtmlNodeAfter,
} from "./html/html_node.js";
export {
  inlineScriptNode,
  inlineLinkStylesheetNode,
  inlineImgNode,
} from "./html/html_inlining.js";
export {
  getHtmlNodePosition,
  getHtmlNodeAttributePosition,
} from "./html/html_node_position.js";
export { getUrlForContentInsideHtml } from "./html/html_inline_content_url.js";

// css
export { parseCssUrls } from "./css/parse_css_urls.js";

// js
export { applyBabelPlugins } from "./js/apply_babel_plugins.js";
export { injectJsImport } from "./js/babel_utils.js";
export { parseJsWithAcorn } from "./js/parse_js_with_acorn.js";
export { parseJsUrls } from "./js/parse_js_urls.js";
export { visitJsAstUntil } from "./js/visit_js_ast_until.js";
export { getUrlForContentInsideJs } from "./js/js_inline_content_url.js";

export { generateUrlForInlineContent } from "./inline_content_url.js";
