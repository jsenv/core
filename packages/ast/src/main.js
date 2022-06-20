// html
export {
  parseHtmlString,
  stringifyHtmlAst,
  parseSvgString,
  stringifySvgAst,
} from "./html/html_parse.js"
export { visitHtmlNodes, findHtmlNode } from "./html/html_search.js"
export { analyzeScriptNode, analyzeLinkNode } from "./html/html_analysis.js"
export {
  getHtmlNodeText,
  removeHtmlNodeText,
  setHtmlNodeText,
  setHtmlNodeGeneratedText,
} from "./html/html_text_node.js"
export { parseSrcSet, stringifySrcSet } from "./html/html_src_set.js"
export {
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
} from "./html/html_node_attributes.js"
export {
  removeHtmlNode,
  createHtmlNode,
  injectScriptNodeAsEarlyAsPossible,
} from "./html/html_node.js"
export {
  inlineScriptNode,
  inlineLinkStylesheetNode,
  inlineImgNode,
} from "./html/html_inlining.js"
export {
  getHtmlNodePosition,
  getHtmlAttributePosition,
} from "./html/html_position.js"

// css
export { applyPostCss } from "./css/apply_post_css.js"
export { transpileWithParcel, minifyWithParcel } from "./css/parcel_css.js"
export { postCssPluginUrlVisitor } from "./css/postcss_plugin_url_visitor.js"

// js
export { applyBabelPlugins } from "./js/apply_babel_plugins.js"
export { injectImport } from "./js/babel_utils.js"
export { applyRollupPlugins } from "./js/apply_rollup_plugins.js" // move to @jsenv/core/src/build/
export { parseJsWithAcorn } from "./js/parse_js_with_acorn.js"
export { parseJsUrls } from "./js/parse_js_urls.js"
