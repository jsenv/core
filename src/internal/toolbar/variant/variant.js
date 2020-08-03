export const enableVariant = (rootNode, variables) => {
  let nodesWithAttribute = Array.from(rootNode.querySelectorAll(`[${attributeName}]`))
  let nodesWithActiveAttribute = Array.from(
    rootNode.querySelectorAll(`[${attributeNameWhenActive}]`),
  )

  Object.keys(variables).forEach((key) => {
    const variableValue = variables[key]

    nodesWithAttribute = nodesWithAttribute.filter((node) => {
      const [keyCandidate, value] = node.getAttribute(attributeName).split(":")
      if (keyCandidate !== key) return true
      if (value !== variableValue) return true

      renameAttribute(node, attributeName, attributeNameWhenActive)
      return false
    })

    nodesWithActiveAttribute = nodesWithActiveAttribute.filter((node) => {
      const [keyCandidate, value] = node.getAttribute(attributeNameWhenActive).split(":")
      if (keyCandidate !== key) return true
      if (value === variableValue) return true

      renameAttribute(node, attributeNameWhenActive, attributeName)
      return false
    })
  })
}

const attributeNameWhenActive = `data-when-active`
const attributeName = `data-when`

const renameAttribute = (node, name, newName) => {
  node.setAttribute(newName, node.getAttribute(name))
  node.removeAttribute(name)
}
