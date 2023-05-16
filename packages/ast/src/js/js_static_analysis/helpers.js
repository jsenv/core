export const getTypePropertyNode = (node) => {
  if (node.type !== "ObjectExpression") {
    return null;
  }
  const { properties } = node;
  return properties.find((property) => {
    return (
      property.type === "Property" &&
      property.key.type === "Identifier" &&
      property.key.name === "type"
    );
  });
};

export const isStringLiteralNode = (node) => {
  return node.type === "Literal" && typeof node.value === "string";
};

export const extractContentInfo = (node) => {
  if (node.type === "StringLiteral") {
    return {
      nodeType: "StringLiteral",
      quote: node.extra.raw[0],
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
