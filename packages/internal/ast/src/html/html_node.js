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

export const createHtmlNode = ({ tagName, children = "", ...rest }) => {
  const html = `<${tagName} ${stringifyAttributes(
    rest,
  )}>${children}</${tagName}>`;
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
    injectWithLineBreakAndIndent(node, bodyNode, 0);
  }
};

export const injectJsenvScript = (
  htmlAst,
  { type, src, content, initCall, pluginName = "jsenv" },
) => {
  const jsenvScriptsNode = getJsenvScriptsNode(htmlAst);
  if (type === "module") {
    if (src) {
      if (initCall) {
        const paramsSource = stringifyParams(initCall.params, "  ");
        const inlineScriptNode = createHtmlNode({
          "tagName": "script",
          "type": "module",
          "jsenv-injected-by": pluginName,
          "children": `import { ${initCall.callee} } from ${src};
    
${initCall.callee}({
  ${paramsSource}
});`,
        });
        insertHtmlNodeInside(inlineScriptNode, jsenvScriptsNode);
        return;
      }
      const remoteScriptNode = createHtmlNode({
        "tagName": "script",
        "type": "module",
        src,
        "jsenv-injected-by": pluginName,
      });
      insertHtmlNodeInside(remoteScriptNode, jsenvScriptsNode);
      return;
    }
    const inlineScriptNode = createHtmlNode({
      "tagName": "script",
      "type": "module",
      "jsenv-injected-by": pluginName,
      "children": content,
    });
    insertHtmlNodeInside(jsenvScriptsNode, inlineScriptNode);
    return;
  }
  if (src) {
    const remoteScriptNode = createHtmlNode({
      "tagName": "script",
      src,
      "jsenv-injected-by": pluginName,
    });
    insertHtmlNodeInside(remoteScriptNode, jsenvScriptsNode);
    if (initCall) {
      const paramsSource = stringifyParams(initCall.params, "  ");
      const inlineScriptNode = createHtmlNode({
        "tagName": "script",
        "jsenv-injected-by": pluginName,
        "children": `${initCall.callee}({
  ${paramsSource}
});`,
      });
      insertHtmlNodeInside(inlineScriptNode, jsenvScriptsNode);
    }
    return;
  }
  const inlineScriptNode = createHtmlNode({
    "tagName": "script",
    "jsenv-injected-by": pluginName,
    "children": content,
  });
  insertHtmlNodeInside(inlineScriptNode, jsenvScriptsNode);
};

const getJsenvScriptsNode = (htmlAst) => {
  // get or insert <jsenv-scripts>
  let jsenvScripts = findHtmlNode(
    htmlAst,
    (node) => node.nodeName === "jsenv-scripts",
  );
  if (jsenvScripts) {
    return jsenvScripts;
  }
  jsenvScripts = createHtmlNode({
    tagName: "jsenv-scripts",
  });
  getAsFirstJsModuleInjector(htmlAst)(jsenvScripts);
  return jsenvScripts;
};
const stringifyParams = (params, prefix = "") => {
  const source = JSON.stringify(params, null, prefix);
  if (prefix.length) {
    // remove leading "{\n"
    // remove leading prefix
    // remove trailing "\n}"
    return source.slice(2 + prefix.length, -2);
  }
  // remove leading "{"
  // remove trailing "}"
  return source.slice(1, -1);
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
    const isJsModule = type === "js_module";
    if (isJsModule) {
      return getAsFirstJsModuleInjector(htmlAst)(node);
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

// <script type="module">
// - after <script type="importmap">
// - and after any <link>
// - and before first <script type="module">
const getAsFirstJsModuleInjector = (htmlAst) => {
  const headNode = findChild(htmlAst, (node) => node.nodeName === "html")
    .childNodes[0];
  const firstImportmapScript = findHtmlNode(htmlAst, (node) => {
    return (
      node.nodeName === "script" && analyzeScriptNode(node).type === "importmap"
    );
  });
  if (firstImportmapScript) {
    return (node) => insertHtmlNodeAfter(node, firstImportmapScript);
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
      return (node) => insertHtmlNodeBefore(node, child);
    }
  }
  if (after) {
    return (node) => insertHtmlNodeAfter(node, after);
  }
  return (node) => injectHtmlNode(htmlAst, node);
};

export const insertHtmlNodeInside = (nodeToInsert, futureParentNode) => {
  const { childNodes = [] } = futureParentNode;
  return injectWithLineBreakAndIndent(
    nodeToInsert,
    futureParentNode,
    childNodes.length,
  );
};

export const insertHtmlNodeBefore = (nodeToInsert, futureNextSibling) => {
  const futureParentNode = futureNextSibling.parentNode;
  const { childNodes = [] } = futureParentNode;
  const futureIndex = childNodes.indexOf(futureNextSibling);
  injectWithLineBreakAndIndent(nodeToInsert, futureParentNode, futureIndex);
};

export const insertHtmlNodeAfter = (nodeToInsert, futurePrevSibling) => {
  const futureParentNode = futurePrevSibling.parentNode;
  const { childNodes = [] } = futureParentNode;
  const futureIndex = childNodes.indexOf(futurePrevSibling) + 1;
  injectWithLineBreakAndIndent(nodeToInsert, futureParentNode, futureIndex);
};

const injectWithLineBreakAndIndent = (
  nodeToInsert,
  futureParentNode,
  futureIndex,
) => {
  const { childNodes = [] } = futureParentNode;
  const previousSiblings = childNodes.slice(0, futureIndex);
  const nextSiblings = childNodes.slice(futureIndex);
  const futureChildNodes = [];

  const previousSibling = childNodes[futureIndex - 1];
  const parentIndentation = getIndentation(futureParentNode);
  const nextSibling = childNodes[futureIndex + 1];
  let childIndentation;
  if (previousSibling) {
    childIndentation = getIndentation(previousSibling);
  } else if (nextSibling) {
    childIndentation = getIndentation(nextSibling);
  } else {
    childIndentation = increaseIndentation(parentIndentation, 2);
  }
  if (previousSiblings.length) {
    futureChildNodes.push(...previousSiblings);
  }
  line_break_and_indent_before: {
    if (nodeToInsert.nodeName === "#text") {
      break line_break_and_indent_before;
    }
    if (!previousSibling) {
      futureChildNodes.push({
        nodeName: "#text",
        value: `\n${childIndentation}`,
        parentNode: futureParentNode,
      });
      break line_break_and_indent_before;
    }
    if (isLineBreakAndIndent(previousSibling)) {
      if (!nextSibling) {
        previousSibling.value = `\n${childIndentation}`;
      }
      break line_break_and_indent_before;
    }
    futureChildNodes.push({
      nodeName: "#text",
      value: `\n${childIndentation}`,
      parentNode: futureParentNode,
    });
  }
  futureChildNodes.push(nodeToInsert);
  nodeToInsert.parentNode = futureParentNode;
  line_break_and_indent_after: {
    if (nodeToInsert.nodeName === "#text") {
      break line_break_and_indent_after;
    }
    if (!nextSibling) {
      futureChildNodes.push({
        nodeName: "#text",
        value: `\n${parentIndentation}`,
        parentNode: futureParentNode,
      });
      break line_break_and_indent_after;
    }
    if (isLineBreakAndIndent(nextSibling)) {
      // nextSibling.value = `\n${indentation}`;
      break line_break_and_indent_after;
    }
    futureChildNodes.push({
      nodeName: "#text",
      value: `\n${childIndentation}`,
      parentNode: futureParentNode,
    });
  }
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

const isLineBreakAndIndent = (htmlNode) => {
  if (htmlNode.nodeName !== "#text") {
    return false;
  }
  const { value } = htmlNode;
  if (value[0] !== "\n") {
    return false;
  }
  return value.slice(1).trim() === "";
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
