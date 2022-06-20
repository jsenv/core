export const getHtmlNodeAttribute = (htmlNode, attributeName) => {
  const attribute = getHtmlAttributeByName(htmlNode, attributeName)
  return attribute ? attribute.value || "" : undefined
}

export const setHtmlNodeAttributes = (htmlNode, attributesToAssign) => {
  if (typeof attributesToAssign !== "object") {
    throw new TypeError(`attributesToAssign must be an object`)
  }
  Object.keys(attributesToAssign).forEach((key) => {
    const existingAttributeIndex = htmlNode.attrs.findIndex(
      ({ name }) => name === key,
    )
    const value = attributesToAssign[key]
    // remove no-op
    if (existingAttributeIndex === -1 && value === undefined) {
      return
    }
    // add
    if (existingAttributeIndex === -1 && value !== undefined) {
      htmlNode.attrs.push({
        name: key,
        value,
      })
      return
    }
    // remove
    if (value === undefined) {
      htmlNode.attrs.splice(existingAttributeIndex, 1)
      return
    }
    // update
    htmlNode.attrs[existingAttributeIndex].value = value
  })
}

const getHtmlAttributeByName = (htmlNode, attributeName) => {
  const attrs = htmlNode.attrs
  const attribute = attrs
    ? attrs.find((attr) => attr.name === attributeName)
    : null
  return attribute
}
