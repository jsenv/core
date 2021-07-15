export const enableVariant = (rootNode, variables) => {
  let nodesNotMatching = Array.from(rootNode.querySelectorAll(`[${attributeIndicatingACondition}]`))
  let nodesMatching = Array.from(rootNode.querySelectorAll(`[${attributeIndicatingAMatch}]`))

  const conditionIsMatching = (condition, key, value) => {
    const [conditionKey, conditionValue] = condition.split(":")
    if (conditionKey !== key) {
      return false
    }
    if (conditionValue !== value) {
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
