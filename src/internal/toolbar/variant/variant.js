export const enableVariant = (rootNode, variables) => {
  let nodesNotMatching = Array.from(rootNode.querySelectorAll(`[${attributeIndicatingACondition}]`))
  let nodesMatching = Array.from(rootNode.querySelectorAll(`[${attributeIndicatingAMatch}]`))

  const parseCondition = (conditionAttributeValue) => {
    const colonIndex = conditionAttributeValue.indexOf(":")
    if (colonIndex === -1) {
      return {
        key: conditionAttributeValue,
        value: undefined,
      }
    }
    return {
      key: conditionAttributeValue.slice(0, colonIndex),
      value: conditionAttributeValue.slice(colonIndex + 1),
    }
  }

  const conditionIsMatching = (conditionAttributeValue, key, value) => {
    const condition = parseCondition(conditionAttributeValue)
    if (condition.key !== key) {
      return false
    }
    // the condition do not specify a value, any value is ok
    if (condition.value === undefined) {
      return true
    }
    if (condition.value !== value) {
      return false
    }
    return true
  }

  Object.keys(variables).forEach((key) => {
    const variableValue = variables[key]

    nodesNotMatching = nodesNotMatching.filter((node) => {
      const condition = node.getAttribute(attributeIndicatingACondition)
      if (conditionIsMatching(condition, key, variableValue)) {
        renameAttribute(node, attributeIndicatingACondition, attributeIndicatingAMatch)
        return false
      }
      return true
    })

    nodesMatching = nodesMatching.filter((node) => {
      const condition = node.getAttribute(attributeIndicatingAMatch)
      if (conditionIsMatching(condition, key, variableValue)) {
        return true
      }
      renameAttribute(node, attributeIndicatingAMatch, attributeIndicatingACondition)
      return false
    })
  })
}

const attributeIndicatingACondition = `data-when`
const attributeIndicatingAMatch = `data-when-active`

const renameAttribute = (node, name, newName) => {
  node.setAttribute(newName, node.getAttribute(name))
  node.removeAttribute(name)
}
