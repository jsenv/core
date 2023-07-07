import { isStringLiteralNode } from "./helpers.js";

export const analyzeImportDeclaration = (node, { onUrl }) => {
  const specifierNode = node.source;
  const assertionInfo = extractImportAssertionsInfo(node);
  const info = {
    type: "js_import",
    subtype: "import_static",
    specifier: specifierNode.value,
    start: specifierNode.start,
    end: specifierNode.end,
    line: specifierNode.loc.start.line,
    column: specifierNode.loc.start.column,
    expectedType: "js_module",
    astInfo: { node: specifierNode },
  };
  if (assertionInfo) {
    const { importAttributes, importNode, importTypeAttributeNode } =
      assertionInfo;
    info.expectedType = importAttributes.type;
    info.importAttributes = importAttributes;
    Object.assign(info.astInfo, { importNode, importTypeAttributeNode });
  }
  onUrl(info);
};
export const analyzeImportExpression = (node, { onUrl }) => {
  const specifierNode = node.source;
  if (!isStringLiteralNode(specifierNode)) {
    return;
  }
  const assertionInfo = extractImportAssertionsInfo(node);
  const info = {
    type: "js_import",
    subtype: "import_dynamic",
    expectedType: "js_module",
    specifier: specifierNode.value,
    start: specifierNode.start,
    end: specifierNode.end,
    line: specifierNode.loc.start.line,
    column: specifierNode.loc.start.column,
    astInfo: { node: specifierNode },
  };
  if (assertionInfo) {
    const { importAttributes, importNode, importTypeAttributeNode } =
      assertionInfo;
    info.expectedType = importAttributes.type;
    info.importAttributes = importAttributes;
    Object.assign(info.astInfo, { importNode, importTypeAttributeNode });
  }
  onUrl(info);
};
export const analyzeExportNamedDeclaration = (node, { onUrl }) => {
  const specifierNode = node.source;
  if (!specifierNode) {
    // This export has no "source", so it's probably
    // a local variable or function, e.g.
    // export { varName }
    // export const constName = ...
    // export function funcName() {}
    return;
  }
  onUrl({
    type: "js_import",
    subtype: "export_named",
    specifier: specifierNode.value,
    start: specifierNode.start,
    end: specifierNode.end,
    line: specifierNode.loc.start.line,
    column: specifierNode.loc.start.column,
    astInfo: { node: specifierNode },
  });
};
export const analyzeExportAllDeclaration = (node, { onUrl }) => {
  const specifierNode = node.source;
  onUrl({
    type: "js_import",
    subtype: "export_all",
    specifier: specifierNode.value,
    start: specifierNode.start,
    end: specifierNode.end,
    line: specifierNode.loc.start.line,
    column: specifierNode.loc.start.column,
    astInfo: { node: specifierNode },
  });
};

const extractImportAssertionsInfo = (node) => {
  if (node.type === "ImportDeclaration") {
    // static import
    const { assertions } = node;
    if (!assertions) {
      return null;
    }
    if (assertions.length === 0) {
      return null;
    }
    const typeAssertionNode = assertions.find(
      (assertion) => assertion.key.name === "type",
    );
    if (!typeAssertionNode) {
      return null;
    }
    const typeNode = typeAssertionNode.value;
    if (!isStringLiteralNode(typeNode)) {
      return null;
    }
    return {
      importAttributes: {
        type: typeNode.value,
      },
      importNode: node,
      importTypeAttributeNode: typeAssertionNode,
    };
  }
  // dynamic import
  const args = node.arguments;
  if (!args) {
    // acorn keeps node.arguments undefined for dynamic import without a second argument
    return null;
  }
  const firstArgNode = args[0];
  if (!firstArgNode) {
    return null;
  }
  const { properties } = firstArgNode;
  const assertProperty = properties.find((property) => {
    return property.key.name === "assert";
  });
  if (!assertProperty) {
    return null;
  }
  const assertValueNode = assertProperty.value;
  if (assertValueNode.type !== "ObjectExpression") {
    return null;
  }
  const assertValueProperties = assertValueNode.properties;
  const typePropertyNode = assertValueProperties.find((property) => {
    return property.key.name === "type";
  });
  if (!typePropertyNode) {
    return null;
  }
  const typePropertyValue = typePropertyNode.value;
  if (!isStringLiteralNode(typePropertyValue)) {
    return null;
  }
  return {
    importAttributes: {
      type: typePropertyValue.value,
    },
    importNode: node,
    importTypeAttributeNode: typePropertyNode,
  };
};
