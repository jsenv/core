export const findPropertyNodeByName = (node, name) => {
  if (node.type !== "ObjectExpression") {
    return null;
  }
  const { properties } = node;
  return properties.find((property) => {
    return (
      property.type === "Property" &&
      property.key.type === "Identifier" &&
      property.key.name === name
    );
  });
};

export const isStringLiteralNode = (node) => {
  return node.type === "Literal" && typeof node.value === "string";
};

export const extractContentInfo = (node) => {
  if (isStringLiteralNode(node)) {
    return {
      nodeType: "StringLiteral",
      quote: node.raw[0],
      content: node.value,
    };
  }
  if (node.type === "TemplateLiteral") {
    const quasis = node.quasis;
    if (quasis.length !== 1) {
      return null;
    }
    const templateElementNode = quasis[0];
    return {
      nodeType: "TemplateLiteral",
      quote: "`",
      content: templateElementNode.value.cooked,
    };
  }
  return null;
};
