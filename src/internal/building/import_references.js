export const visitImportReferences = async ({
  ast,
  onReferenceWithImportMetaUrlPattern,
  onReferenceWithImportAssertion,
}) => {
  const { asyncWalk } = await import("estree-walker")

  await asyncWalk(ast, {
    enter: async (node, parent) => {
      if (isNewUrlImportMetaUrl(node)) {
        await onReferenceWithImportMetaUrlPattern({
          importNode: node,
        })
        return
      }

      if (node.type === "ImportDeclaration") {
        const { assertions = [] } = node
        if (assertions.length === 0) {
          return
        }
        const assertionsDescriptor = getImportAssertionsDescriptor(assertions)
        await onReferenceWithImportAssertion({
          importNode: node,
          assertions: assertionsDescriptor,
        })
        return
      }

      if (
        node.type === "ObjectExpression" &&
        parent.type === "ImportExpression"
      ) {
        const { properties } = node
        const assertProperty = properties.find((property) => {
          return property.key.name === "assert"
        })
        if (!assertProperty) {
          return
        }

        const assertProperties = assertProperty.value.properties
        const typePropertyNode = assertProperties.find((property) => {
          return property.key.name === "type"
        })
        if (!typePropertyNode) {
          return
        }

        await onReferenceWithImportAssertion({
          importNode: parent,
          typePropertyNode,
        })
        return
      }
    },
  })
}

const isNewUrlImportMetaUrl = (node) => {
  return (
    node.type === "NewExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "URL" &&
    node.arguments.length === 2 &&
    node.arguments[0].type === "Literal" &&
    typeof node.arguments[0].value === "string" &&
    node.arguments[1].type === "MemberExpression" &&
    node.arguments[1].object.type === "MetaProperty" &&
    node.arguments[1].property.type === "Identifier" &&
    node.arguments[1].property.name === "url"
  )
}

const getImportAssertionsDescriptor = (importAssertions) => {
  const assertionAttributes = {}
  importAssertions.forEach((importAssertion) => {
    assertionAttributes[importAssertion.key.name] = importAssertion.value.value
  })
  return assertionAttributes
}
