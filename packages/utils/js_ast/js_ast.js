export const getTypePropertyNode = (node) => {
  if (node.type !== "ObjectExpression") {
    return null
  }
  const { properties } = node
  return properties.find((property) => {
    return (
      property.key.type === "Identifier" &&
      property.key.name === "type" &&
      property.type === "ObjectProperty"
    )
  })
}
