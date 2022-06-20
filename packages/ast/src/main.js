/*
 * TODO: organize into groups such as:
 * - HTML_AST
 *   - parse
 *   - stringify
 *   - removeAttributeByName
 *   - removeAttribute
 *   - setAttributes
 * - JS_AST
 *   - applyBabelPlugins
 *   - parseWithAcorn
 *   - injectImport
 *
 */

// html
export {
  parseHtmlString,
  parseSvgString,
  stringifyHtmlAst,
  htmlNodePosition,
  findNode,
  findNodes,
  findNodeByTagName,
  findHtmlNodeById,
  findAllNodeByTagName,
  findFirstImportMapNode,
  getHtmlNodeAttributeByName,
  getHtmlNodeTextNode,
  setHtmlNodeGeneratedText,
  setHtmlNodeText,
  removeHtmlNodeText,
  removeHtmlNode,
  findHtmlNode,
  htmlNodeIsScriptModule,
  htmlNodeIsScriptImportmap,
  parseHtmlAstRessources,
  parseLinkNode,
  parseScriptNode,
  createHtmlNode,
  injectScriptAsEarlyAsPossible,
  removeHtmlNodeAttributeByName,
  removeHtmlNodeAttribute,
  assignHtmlNodeAttributes,
  visitHtmlAst,
} from "./html/html_ast.js"
export { htmlAttributeSrcSet } from "./html/html_attribute_src_set.js"
export {
  inlineScript,
  inlineLinkStylesheet,
  inlineImg,
} from "./html/html_inlining.js"

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
