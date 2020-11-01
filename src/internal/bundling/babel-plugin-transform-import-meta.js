import { require } from "@jsenv/core/src/internal/require.js"

// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7
const { addDefault, addNamed } = require("@babel/helper-module-imports")

export const babelPluginTransformImportMeta = (api, { replaceImportMeta }) => {
  const { parse } = api
  debugger

  return {
    visitor: {
      Program(programPath) {
        const metaPropertyPathMap = {}

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
            if (name in metaPropertyPathMap) {
              metaPropertyPathMap[name].push(path)
            } else {
              metaPropertyPathMap[name] = [path]
            }
          },
        })

        Object.keys(metaPropertyPathMap).forEach((importMetaPropertyName) => {
          replaceImportMeta(importMetaPropertyName, {
            replaceWithImport: ({ name, from }) => {
              let importAst
              if (name) {
                importAst = addNamed(programPath, name, from)
              } else {
                importAst = addDefault(programPath, from)
              }
              metaPropertyPathMap[importMetaPropertyName].forEach((path) => {
                path.replaceWith(importAst)
              })
            },
            replaceWithValue: (value) => {
              const valueAst = parseExpression(value)
              metaPropertyPathMap[importMetaPropertyName].forEach((path) => {
                path.replaceWith(valueAst)
              })
            },
          })
        })
      },
    },
  }
}
