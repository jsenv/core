export const getAttributeByName = (htmlNode, attributeName) => {
  const attrs = htmlNode.attrs
  return attrs && attrs.find((attr) => attr.name === attributeName)
}

export const removeAttribute = (htmlNode, attributeToRemove) => {
  const attrIndex = htmlNode.attrs.indexOf(attributeToRemove)
  if (attrIndex === -1) {
    return false
  }
  htmlNode.attrs.splice(attrIndex, 1)
  return true
}

export const removeAttributeByName = (htmlNode, attributeName) => {
  const attr = getAttributeByName(htmlNode, attributeName)
  return attr ? removeAttribute(htmlNode, attr) : false
}

export const setAttributes = (htmlNode, attributesToAssign) => {
  if (typeof attributesToAssign !== "object") {
    throw new TypeError(`attributesToAssign must be an object`)
  }
  Object.keys(attributesToAssign).forEach((key) => {
    const existingAttributeIndex = htmlNode.attrs.findIndex(
      ({ name }) => name === key,
    )
    const value = attributesToAssign[key]
    if (existingAttributeIndex === -1) {
      htmlNode.attrs.push({
        name: key,
        value,
      })
    } else {
      htmlNode.attrs[existingAttributeIndex].value = value
    }
  })
}
