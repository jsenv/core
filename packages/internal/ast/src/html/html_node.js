import { parseFragment } from "parse5";

import {
  getHtmlNodeAttribute,
  setHtmlNodeAttributes,
} from "./html_node_attributes.js";
import { findHtmlNode } from "./html_search.js";
import { analyzeScriptNode } from "./html_analysis.js";
import {
  getIndentation,
  increaseIndentation,
  getHtmlNodeText,
  setHtmlNodeText,
} from "./html_node_text.js";

export const removeHtmlNode = (htmlNode) => {
  const { childNodes } = htmlNode.parentNode;
  childNodes.splice(childNodes.indexOf(htmlNode), 1);
};

export const createHtmlNode = ({ tagName, textContent = "", ...rest }) => {
  const html = `<${tagName} ${stringifyAttributes(
    rest,
  )}>${textContent}</${tagName}>`;
  const fragment = parseFragment(html);
  return fragment.childNodes[0];
};

export const injectHtmlNode = (htmlAst, node, jsenvPluginName = "jsenv") => {
  setHtmlNodeAttributes(node, {
    "jsenv-injected-by": jsenvPluginName,
  });
  const htmlNode = findChild(htmlAst, (node) => node.nodeName === "html");
  const bodyNode = findChild(htmlNode, (node) => node.nodeName === "body");
  let after;
  if (node.nodeName !== "#text") {
    // last child that is not a text
    for (const child of bodyNode.childNodes) {
      if (child.nodeName !== "#text") {
        after = child;
        break;
      }
      after = child;
    }
  }
  if (after) {
    insertHtmlNodeAfter(node, after);
  } else {
    injectWithWhitespaces(node, bodyNode, 0);
  }
};

export const injectHtmlNodeAsEarlyAsPossible = (
  htmlAst,
  node,
  jsenvPluginName = "jsenv",
) => {
  setHtmlNodeAttributes(node, {
    "jsenv-injected-by": jsenvPluginName,
  });
  const isScript = node.nodeName === "script";
  if (isScript) {
    const { type } = analyzeScriptNode(node);
    const headNode = findChild(htmlAst, (node) => node.nodeName === "html")
      .childNodes[0];

    // <script type="importmap">
    // - after any <link>
    // - but before first <link rel="modulepreload">
    // - and before <script type="module">
    const isImportmap = type === "importmap";
    if (isImportmap) {
      let after = headNode.childNodes[0];
      for (const child of headNode.childNodes) {
        if (child.nodeName === "link") {
          if (getHtmlNodeAttribute(child, "rel") === "modulepreload") {
            return insertHtmlNodeBefore(node, child);
          }
          after = child;
          continue;
        }
        if (
          child.nodeName === "script" &&
          analyzeScriptNode(child).type === "module"
        ) {
          return insertHtmlNodeBefore(node, child);
        }
      }
      if (after) {
        return insertHtmlNodeAfter(node, after);
      }
      return injectHtmlNode(htmlAst, node);
    }
    // <script type="module">
    // - after <script type="importmap">
    // - and after any <link>
    // - and before first <script type="module">
    const isJsModule = type === "js_module";
    if (isJsModule) {
      const firstImportmapScript = findHtmlNode(htmlAst, (node) => {
        return (
          node.nodeName === "script" &&
          analyzeScriptNode(node).type === "importmap"
        );
      });
      if (firstImportmapScript) {
        return insertHtmlNodeAfter(node, firstImportmapScript);
      }
      let after = headNode.childNodes[0];
      for (const child of headNode.childNodes) {
        if (child.nodeName === "link") {
          after = child;
          continue;
        }
        if (
          child.nodeName === "script" &&
          analyzeScriptNode(child).type === "module"
        ) {
          return insertHtmlNodeBefore(node, child);
        }
      }
      if (after) {
        return insertHtmlNodeAfter(node, after);
      }
      return injectHtmlNode(htmlAst, node);
    }
    // <script> or <script type="text/jsx">, ...
    // - after any <link>
    // - before any <script>
    let after = headNode.childNodes[0];
    for (const child of headNode.childNodes) {
      if (child.nodeName === "link") {
        after = child;
        continue;
      }
      if (child.nodeName === "script") {
        return insertHtmlNodeBefore(node, child);
      }
    }
    if (after) {
      return insertHtmlNodeAfter(node, after);
    }
    return injectHtmlNode(htmlAst, node);
  }
  return injectHtmlNode(htmlAst, node);
};

export const insertHtmlNodeBefore = (nodeToInsert, futureNextSibling) => {
  const futureParentNode = futureNextSibling.parentNode;
  const { childNodes = [] } = futureParentNode;
  const futureIndex = childNodes.indexOf(futureNextSibling);
  injectWithWhitespaces(nodeToInsert, futureParentNode, futureIndex);
};

export const insertHtmlNodeAfter = (nodeToInsert, futurePrevSibling) => {
  const futureParentNode = futurePrevSibling.parentNode;
  const { childNodes = [] } = futureParentNode;
  const futureIndex = childNodes.indexOf(futurePrevSibling) + 1;
  injectWithWhitespaces(nodeToInsert, futureParentNode, futureIndex);
};

const injectWithWhitespaces = (nodeToInsert, futureParentNode, futureIndex) => {
  const { childNodes = [] } = futureParentNode;
  const previousSiblings = childNodes.slice(0, futureIndex);
  const nextSiblings = childNodes.slice(futureIndex);
  const futureChildNodes = [];

  if (previousSiblings.length) {
    futureChildNodes.push(...previousSiblings);
  }
  const previousSibling = childNodes[futureIndex - 1];
  if (
    nodeToInsert.nodeName !== "#text" &&
    (!previousSibling || !isWhitespaceNode(previousSibling))
  ) {
    let indentation;
    if (childNodes.length) {
      indentation = getIndentation(childNodes[childNodes.length - 1]);
    } else {
      const parentIndentation = getIndentation(futureParentNode);
      indentation = increaseIndentation(parentIndentation, 2);
    }
    futureChildNodes.push({
      nodeName: "#text",
      value: `\n${indentation}`,
      parentNode: futureParentNode,
    });
  }
  futureChildNodes.push(nodeToInsert);
  nodeToInsert.parentNode = futureParentNode;
  if (nextSiblings.length) {
    futureChildNodes.push(...nextSiblings);
  }
  futureParentNode.childNodes = futureChildNodes;

  // update indentation when node contains text
  const text = getHtmlNodeText(nodeToInsert);
  if (text) {
    setHtmlNodeText(nodeToInsert, text, { indentation: "auto" });
  }
};

const isWhitespaceNode = (node) => {
  if (node.nodeName !== "#text") return false;
  if (node.value.length === 0) return false;
  return /^\s+$/.test(node.value);
};

const findChild = ({ childNodes = [] }, predicate) =>
  childNodes.find(predicate);

const stringifyAttributes = (object) => {
  let string = "";
  Object.keys(object).forEach((key) => {
    const value = object[key];
    if (value === undefined) return;
    if (string !== "") string += " ";
    string += `${key}=${valueToHtmlAttributeValue(value)}`;
  });
  return string;
};

const valueToHtmlAttributeValue = (value) => {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return `"${JSON.stringify(value)}"`;
};
