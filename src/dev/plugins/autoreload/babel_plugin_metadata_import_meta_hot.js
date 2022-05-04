// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

export const babelPluginMetadataImportMetaHot = () => {
  return {
    name: "metadata-import-meta-hot",
    visitor: {
      Program(programPath, state) {
        Object.assign(
          state.file.metadata,
          collectImportMetaProperties(programPath),
        )
      },
    },
  }
}
const collectImportMetaProperties = (programPath) => {
  let importMetaHotDetected = false
  let hotDecline = false
  let hotAcceptSelf = false
  let hotAcceptDependencies = []
  programPath.traverse({
    MemberExpression(path) {
      if (importMetaHotDetected) return
      const { node } = path
      const { object } = node
      if (object.type !== "MetaProperty") {
        return
      }
      const { property: objectProperty } = object
      if (objectProperty.name !== "meta") {
        return
      }
      const { property } = node
      const { name } = property
      if (name === "hot") {
        importMetaHotDetected = true
      }
    },
    CallExpression(path) {
      if (isImportMetaHotMethodCall(path, "accept")) {
        const callNode = path.node
        const args = callNode.arguments
        if (args.length === 0) {
          hotAcceptSelf = true
          return
        }
        const firstArg = args[0]
        if (firstArg.type === "StringLiteral") {
          hotAcceptDependencies = [
            {
              specifierPath: path.get("arguments")[0],
            },
          ]
          return
        }
        if (firstArg.type === "ArrayExpression") {
          const firstArgPath = path.get("arguments")[0]
          hotAcceptDependencies = firstArg.elements.map((arrayNode, index) => {
            if (arrayNode.type !== "StringLiteral") {
              throw new Error(
                `all array elements must be strings in "import.meta.hot.accept(array)"`,
              )
            }
            return {
              specifierPath: firstArgPath.get(String(index)),
            }
          })
          return
        }
        // accept first arg can be "anything" such as
        // `const cb = () => {}; import.meta.accept(cb)`
        hotAcceptSelf = true
      }
      if (isImportMetaHotMethodCall(path, "decline")) {
        hotDecline = true
      }
    },
  })
  return {
    importMetaHotDetected,
    hotDecline,
    hotAcceptSelf,
    hotAcceptDependencies,
  }
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
