import { getHtmlNodeAttribute } from "./html_node_attributes.js";

export const visitHtmlNodes = (htmlAst, visitors) => {
  const visitNode = (node) => {
    const visitor = visitors[node.nodeName] || visitors["*"];
    if (visitor) {
      const callbackReturnValue = visitor(node);
      if (callbackReturnValue === "stop") {
        return;
      }
    }
    const { childNodes } = node;
    if (childNodes) {
      let i = 0;
      while (i < childNodes.length) {
        visitNode(childNodes[i++]);
      }
    }
  };
  visitNode(htmlAst);
};

export const findHtmlNode = (htmlAst, predicate) => {
  let nodeMatching = null;
  visitHtmlNodes(htmlAst, {
    "*": (node) => {
      if (predicate(node)) {
        nodeMatching = node;
        return "stop";
      }
      return null;
    },
  });
  return nodeMatching;
};

export const findHtmlChildNode = (htmlNode, predicate) => {
  const { childNodes = [] } = htmlNode;
  return childNodes.find(predicate);
};

export const findHtmlNodes = (htmlAst, predicate) => {
  const nodes = [];
  visitHtmlNodes(htmlAst, {
    "*": (node) => {
      if (predicate(node)) {
        nodes.push(node);
      }
      return null;
    },
  });
  return nodes;
};

export const findHtmlNodeByTagName = (htmlAst, tagName) => {
  return findHtmlNode(htmlAst, (node) => node.nodeName === tagName);
};

export const findHtmlNodeById = (htmlAst, id) => {
  return findHtmlNode(htmlAst, (node) => {
    const idCandidate = getHtmlNodeAttribute(node, "id");
    return idCandidate === id;
  });
};
