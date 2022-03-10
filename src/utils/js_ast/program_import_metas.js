export const collectProgramImportMetas = (programPath) => {
  const importMetas = {}
  programPath.traverse({
    MemberExpression(path) {
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
      const importMetaPaths = importMetas[name]
      if (importMetaPaths) {
        importMetaPaths.push(path)
      } else {
        importMetas[name] = [path]
      }
    },
  })
  return importMetas
}
