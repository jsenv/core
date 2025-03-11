import { isStringLiteralNode } from "./helpers.js";

export const isNewUrlCall = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "URL"
  );
};
export const analyzeNewUrlCall = (node, { isJsModule, onUrl }) => {
  if (node.arguments.length === 1) {
    const firstArgNode = node.arguments[0];
    const urlType = analyzeUrlNodeType(firstArgNode, { isJsModule });
    if (urlType === "StringLiteral") {
      const specifierNode = firstArgNode;
      onUrl({
        type: "js_url",
        subtype: "new_url_first_arg",
        specifier: specifierNode.value,
        start: specifierNode.start,
        end: specifierNode.end,
        line: specifierNode.loc.start.line,
        column: specifierNode.loc.start.column,
        astInfo: { node: specifierNode },
      });
    }
    return;
  }
  if (node.arguments.length === 2) {
    const firstArgNode = node.arguments[0];
    const secondArgNode = node.arguments[1];
    const baseUrlType = analyzeUrlNodeType(secondArgNode, { isJsModule });
    if (baseUrlType) {
      // we can understand the second argument
      if (
        baseUrlType === "StringLiteral" &&
        secondArgNode.value === "file:///"
      ) {
        // ignore new URL(specifier, "file:///")
        return;
      }
      const urlType = analyzeUrlNodeType(firstArgNode, { isJsModule });
      if (urlType === "StringLiteral") {
        // we can understand the first argument
        const specifierNode = firstArgNode;
        onUrl({
          type: "js_url",
          subtype: "new_url_first_arg",
          specifier: specifierNode.value,
          start: specifierNode.start,
          end: specifierNode.end,
          line: specifierNode.loc.start.line,
          column: specifierNode.loc.start.column,
          baseUrlType,
          baseUrl:
            baseUrlType === "StringLiteral" ? secondArgNode.value : undefined,
          astInfo: { node: firstArgNode },
        });
      }
      if (baseUrlType === "StringLiteral") {
        const specifierNode = secondArgNode;
        onUrl({
          type: "js_url",
          subtype: "new_url_second_arg",
          specifier: specifierNode.value,
          start: specifierNode.start,
          end: specifierNode.end,
          line: specifierNode.loc.start.line,
          column: specifierNode.loc.start.column,
          astInfo: { node: specifierNode },
        });
      }
    }
  }
};

const analyzeUrlNodeType = (secondArgNode, { isJsModule }) => {
  if (isStringLiteralNode(secondArgNode)) {
    return "StringLiteral";
  }
  if (isImportMetaUrl(secondArgNode)) {
    return "import.meta.url";
  }
  if (isWindowLocation(secondArgNode)) {
    return "window.location";
  }
  if (isWindowOrigin(secondArgNode)) {
    return "window.origin";
  }
  if (!isJsModule && isContextMetaUrlFromSystemJs(secondArgNode)) {
    return "context.meta.url";
  }
  if (!isJsModule) {
    if (isDocumentCurrentScriptSrc(secondArgNode)) {
      return "document.currentScript.src";
    }
    // new URL('specifier', document.currentScript.src)
    // becomes
    // var _currentUrl = document.currentScript.src
    // new URL('specifier', currentUrl)
    // (search for scope.generateUidIdentifier("currentUrl")
    if (secondArgNode.type === "Identifier") {
      return "document.currentScript.src";
    }
  }
  return null;
};

const isImportMetaUrl = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "MetaProperty" &&
    node.property.type === "Identifier" &&
    node.property.name === "url"
  );
};

const isWindowLocation = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "window" &&
    node.property.type === "Identifier" &&
    node.property.name === "location"
  );
};

const isWindowOrigin = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "window" &&
    node.property.type === "Identifier" &&
    node.property.name === "origin"
  );
};

const isContextMetaUrlFromSystemJs = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "MemberExpression" &&
    node.object.object.type === "Identifier" &&
    // because of minification we can't assume _context.
    // so anything matching "*.meta.url" (in the context of new URL())
    // will be assumed to be the equivalent to "import.meta.url"
    // node.object.object.name === "_context" &&
    node.object.property.type === "Identifier" &&
    node.object.property.name === "meta" &&
    node.property.type === "Identifier" &&
    node.property.name === "url"
  );
};

const isDocumentCurrentScriptSrc = (node) => {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "MemberExpression" &&
    node.object.object.type === "Identifier" &&
    node.object.object.name === "document" &&
    node.object.property.type === "Identifier" &&
    node.object.property.name === "currentScript" &&
    node.property.type === "Identifier" &&
    node.property.name === "src"
  );
};
