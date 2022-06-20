import { parseString, stringifyAst } from "./html_parse.js"
import {
  storeNodePosition,
  getNodePosition,
  storeAttributePosition,
  getAttributePosition,
} from "./html_position.js"
import { visitNodes, findNode, findChildNode } from "./html_search.js"
import { analyzeScriptNode, analyzeLinkNode } from "./html_analysis.js"
import {
  createNode,
  injectScriptAsEarlyAsPossible,
  removeNode,
} from "./html_node.js"
import {
  getAttributeByName,
  removeAttributeByName,
  removeAttribute,
  setAttributes,
} from "./html_attributes.js"
import {
  getTextNode,
  removeTextNode,
  readTextNode,
  writeTextNode,
  writeGeneratedTextNode,
} from "./html_text_node.js"
import {
  inlineImg,
  inlineScript,
  inlineLinkStylesheet,
} from "./html_inlining.js"

export const HTML_AST = {
  parseString,
  stringifyAst,
  // position
  storeNodePosition,
  getNodePosition,
  storeAttributePosition,
  getAttributePosition,
  // finding nodes
  visitNodes,
  findNode,
  findChildNode,
  analyzeScriptNode,
  analyzeLinkNode,
  // attributes api
  getAttributeByName,
  removeAttributeByName,
  removeAttribute,
  setAttributes,
  // manipulating nodes
  createNode,
  injectScriptAsEarlyAsPossible,
  removeNode,
  // text nodes
  getTextNode,
  removeTextNode,
  readTextNode,
  writeTextNode,
  writeGeneratedTextNode,
  // inlining nodes
  inlineScript,
  inlineLinkStylesheet,
  inlineImg,
}
