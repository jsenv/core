// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

import { require } from "@jsenv/core/src/internal/require.js"

const { addNamespace, addDefault, addNamed } = require("@babel/helper-module-imports")
const { parseExpression } = require("@babel/parser")

export const babelPluginTransformImportMeta = (api, pluginOptions) => {
  const { replaceImportMeta } = pluginOptions

  let babelState
  const jsValueToAst = (jsValue) => {
    const valueAst = parseExpression(jsValue, babelState.opts)
    return valueAst
  }

  return {
    pre: (state) => {
      babelState = state
    },

    //  visitor: {
    //     Program(programPath) {
    //       const paths = []
    //       programPath.traverse({
    //         MetaProperty(metaPropertyPath) {
    //           const metaPropertyNode = metaPropertyPath.node
    //           if (!metaPropertyNode.meta) {
    //             return
    //           }
    //           if (metaPropertyNode.meta.name !== "import") {
    //             return
    //           }
    //           if (metaPropertyNode.property.name !== "meta") {
    //             return
    //           }
    //           paths.push(metaPropertyPath)
    //         },
    //       })

    //       const importAst = addNamespace(programPath, importMetaSpecifier)
    //       paths.forEach((path) => {
    //         path.replaceWith(importAst)
    //       })
    //     },

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
            replaceWithImport: ({ namespace, name, from, nameHint }) => {
              let importAst
              if (namespace) {
                importAst = addNamespace(programPath, from, {
                  nameHint,
                })
              } else if (name) {
                importAst = addNamed(programPath, name, from)
              } else {
                importAst = addDefault(programPath, from, {
                  nameHint,
                })
              }
              metaPropertyPathMap[importMetaPropertyName].forEach((path) => {
                path.replaceWith(importAst)
              })
            },
            replaceWithValue: (value) => {
              const valueAst = jsValueToAst(
                // eslint-disable-next-line no-nested-ternary
                value === undefined ? "undefined" : value === null ? "null" : JSON.stringify(value),
              )
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
