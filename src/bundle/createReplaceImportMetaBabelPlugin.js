// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
import template from "@babel/template"

export const createReplaceImportMetaBabelPlugin = ({ importMetaSource }) => {
  return () => {
    return {
      visitor: {
        Program(programPath) {
          const metas = []
          const identifiers = new Set()

          programPath.traverse({
            MetaProperty(path) {
              const { node, scope } = path

              if (node.meta && node.meta.name === "import" && node.property.name === "meta") {
                metas.push(path)
              }

              Object.keys(scope.getAllBindings()).forEach((name) => {
                identifiers.add(name)
              })
            },
          })

          if (metas.length === 0) {
            return
          }

          const importMetaId = "importMeta"
          let importMetaUniqId = importMetaId
          while (identifiers.has(importMetaUniqId)) {
            importMetaUniqId = programPath.scope.generateUidIdentifier(importMetaId).name
          }

          programPath.node.body.unshift(
            template.ast(`const ${importMetaUniqId} = ${importMetaSource}`, {
              plugins: ["importMeta"],
            }),
          )

          for (const meta of metas) {
            meta.replaceWith(template.ast`${importMetaUniqId}`)
          }
        },
      },
    }
  }
}
