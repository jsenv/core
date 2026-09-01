// tslint:disable:ordered-imports

// html
export {
  parseHtml,
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
  getHtmlNodeAttributes,
  setHtmlNodeAttributes,
} from "./html/html_node_attributes.js";
export {
  removeHtmlNode,
  createHtmlNode,
  injectHtmlNode,
  injectHtmlNodeAsEarlyAsPossible,
  insertHtmlNodeAfter,
  insertHtmlNodeInside,
  injectJsenvScript,
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
// Fork of "babel-plugin-transform-async-to-promises". It was forked for
// https://github.com/rpetrich/babel-plugin-transform-async-to-promises/issues/84
// and the upstream package is unmaintained since 2022, so it also never got the
// babel 8 fixes (parse/transformFromAst became async-only, TraversalContext#create
// is gone). It lives in this package because this package has no dist: every
// consumer reads the same source, so no build has to run before another one.
export { default as babelPluginAsyncToPromises } from "./js/async_to_promises/async-to-promises.js";
export { injectJsImport } from "./js/babel_utils.js";
export { parseJsWithAcorn } from "./js/parse_js_with_acorn.js";
export { parseJsUrls } from "./js/parse_js_urls.js";
export { visitJsAstUntil } from "./js/visit_js_ast_until.js";
export { visitJsAst } from "./js/visit_js_ast.js";
export { getImportMetaPropertyName } from "./js/import_meta.js";
export { getUrlForContentInsideJs } from "./js/js_inline_content_url.js";
export { renderCssTemplateLiteral } from "./js/js_static_analysis/css_template_substitutions.js";

export { generateUrlForInlineContent } from "./inline_content_url.js";
