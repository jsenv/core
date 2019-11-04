// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
const { addNamed } = import.meta.require("@babel/helper-module-imports")

export const createImportMetaUrlNamedImportBabelPlugin = ({ importMetaFacadeUrl }) => {
  return () => {
    return {
      visitor: {
        Program(programPath) {
          const metaPropertyMap = {}

          programPath.traverse({
            MemberExpression(path) {
              const { node } = path
              const { object } = node
              if (object.type !== "MetaProperty") return

              const { property: objectProperty } = object
              if (objectProperty.name !== "meta") return

              const { property } = node
              const { name } = property
              if (name in metaPropertyMap) {
                metaPropertyMap[name].push(path)
              } else {
                metaPropertyMap[name] = [path]
              }
            },
          })

          Object.keys(metaPropertyMap).forEach((propertyName) => {
            const importMetaPropertyId = propertyName
            const result = addNamed(programPath, importMetaPropertyId, importMetaFacadeUrl)
            metaPropertyMap[propertyName].forEach((path) => {
              path.replaceWith(result)
            })
          })
        },
      },
    }
  }
}
