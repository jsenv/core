export const babelPluginMetadataImportAssertions = () => {
  return {
    name: "metadata-import-assertions",
    visitor: {
      Program: (programPath, state) => {
        const importAssertions = collectProgramImportAssertions(programPath)
        state.file.metadata.importAssertions = importAssertions
      },
    },
  }
}

/*
 * Jsenv wont touch code where "specifier" or "type" is dynamic (see code below)
 * ```js
 * const file ="./style.css"
 * const type = "css"
 * import(file, { assert: { type }})
 * ```
 * Jsenv could throw an error because we know browser will fail to execute the code
 * because import assertions are not supported.
 * But for now (as it is simpler to do so) we let the browser throw the error
 */
const collectProgramImportAssertions = (programPath) => {
  const importAssertions = []
  programPath.traverse({
    CallExpression: (path) => {
      if (path.node.callee.type !== "Import") {
        // Some other function call, not import();
        return
      }
      if (path.node.arguments[0].type !== "StringLiteral") {
        // Non-string argument, probably a variable or expression, e.g.
        // import(moduleId)
        // import('./' + moduleName)
        return
      }
      const args = path.node.arguments
      const secondArg = args[1]
      if (!secondArg) {
        return
      }
      const { properties } = secondArg
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
      const typePropertyValue = typePropertyNode.value
      if (typePropertyValue.type !== "StringLiteral") {
        return
      }
      const type = typePropertyValue.value
      importAssertions.push({
        path,
        assert: {
          type,
        },
      })
    },

    ImportDeclaration: (path) => {
      const { assertions } = path.node
      if (!assertions) {
        return
      }
      if (assertions.length === 0) {
        return
      }
      const typeAssertion = assertions.find(
        (assertion) => assertion.key.name === "type",
      )
      if (!typeAssertion) {
        return
      }
      const typeNode = typeAssertion.value
      if (typeNode.type !== "StringLiteral") {
        return
      }
      const type = typeNode.value
      importAssertions.push({
        path,
        assert: {
          type,
        },
      })
    },
  })
  return importAssertions
}
