export const getTypePropertyNode = (node) => {
  if (node.type !== "ObjectExpression") {
    return null
  }
  const { properties } = node
  return properties.find((property) => {
    return (
      property.type === "Property" &&
      property.key.type === "Identifier" &&
      property.key.name === "type"
    )
  })
}

export const isStringLiteralNode = (node) => {
  return node.type === "Literal" && typeof node.value === "string"
}
