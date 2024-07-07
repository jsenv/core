import { isStringLiteralNode } from "./helpers.js";

export const analyzeImportDeclaration = (node, { onUrl }) => {
  const specifierNode = node.source;
  const attributesInfo = extractImportAttributesInfo(node);
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
  if (attributesInfo) {
    const { importAttributes, importNode, importTypeAttributeNode } =
      attributesInfo;
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
  const attributesInfo = extractImportAttributesInfo(node);
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
  if (attributesInfo) {
    const { importAttributes, importNode, importTypeAttributeNode } =
      attributesInfo;
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

const extractImportAttributesInfo = (node) => {
  if (node.type === "ImportDeclaration") {
    // static import
    const { attributes } = node;
    if (!attributes) {
      return null;
    }
    if (attributes.length === 0) {
      return null;
    }
    const typeAttributeNode = attributes.find(
      (attributeNode) => attributeNode.key.name === "type",
    );
    if (!typeAttributeNode) {
      return null;
    }
    const typeNode = typeAttributeNode.value;
    if (!isStringLiteralNode(typeNode)) {
      return null;
    }
    return {
      importAttributes: {
        type: typeNode.value,
      },
      importNode: node,
      importTypeAttributeNode: typeAttributeNode,
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
  const withProperty = properties.find((property) => {
    return property.key.name === "assert";
  });
  if (!withProperty) {
    return null;
  }
  const withValueNode = withProperty.value;
  if (withValueNode.type !== "ObjectExpression") {
    return null;
  }
  const withValueProperties = withValueNode.properties;
  const typePropertyNode = withValueProperties.find((property) => {
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
