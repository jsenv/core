// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

export const babelPluginMetadataImportMetaHot = () => {
  return {
    name: "metadata-import-meta-hot",
    visitor: {
      Program(programPath) {
        const { hotDecline, hotAcceptSelf, hotAcceptDependencies } =
          collectImportMetaProperties(programPath)
        Object.assign(this.file.metadata, {
          hotDecline,
          hotAcceptSelf,
          hotAcceptDependencies,
        })
      },
    },
  }
}

const collectImportMetaProperties = (programPath) => {
  const importMetaHotProperties = {}
  programPath.traverse({
    CallExpression(path) {
      if (isImportMetaHotMethodCall(path, "accept")) {
        const callNode = path.node
        const args = callNode.arguments
        if (args.length === 0) {
          importMetaHotProperties.hotAcceptSelf = true
          return
        }
        const firstArg = args[0]
        if (firstArg.type === "StringLiteral") {
          importMetaHotProperties.hotAcceptDependencies = [firstArg.value]
          return
        }
        if (firstArg.type === "ArrayExpression") {
          const dependencies = firstArg.elements.map((arrayNode) => {
            if (arrayNode.type !== "StringLiteral") {
              throw new Error(
                `all array elements must be strings in "import.meta.hot.accept(array)"`,
              )
            }
            return arrayNode.value
          })
          importMetaHotProperties.hotAcceptDependencies = dependencies
          return
        }
        // accept first arg can be "anything"
        importMetaHotProperties.hotAcceptSelf = true
      }
      if (isImportMetaHotMethodCall(path, "decline")) {
        importMetaHotProperties.hotDecline = true
      }
    },
  })
  return importMetaHotProperties
}

const isImportMetaHotMethodCall = (path, methodName) => {
  const { property, object } = path.node.callee
  return (
    property &&
    property.name === methodName &&
    object &&
    object.property &&
    object.property.name === "hot" &&
    object.object.type === "MetaProperty"
  )
}
