// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

import { require } from "@jsenv/core/src/internal/require.js"

import { createParseError } from "./babel_parse_error.js"

export const babelPluginTransformImportMeta = (api, { importMetaFormat }) => {
  const {
    addNamespace,
    addDefault,
    addNamed,
  } = require("@babel/helper-module-imports")
  let babelState
  const jsValueToAst = (jsValue) => {
    const { parseExpression } = require("@babel/parser")
    const valueAst = parseExpression(jsValue, babelState.parserOpts)
    return valueAst
  }
  const visitImportMetaProperty = ({
    importMetaPropertyName,
    replaceWithImport,
    replaceWithValue,
  }) => {
    if (importMetaFormat === "esmodule") {
      // keep native version
      return
    }
    if (importMetaFormat === "systemjs") {
      // systemjs will handle it
      return
    }
    if (importMetaFormat === "commonjs") {
      if (importMetaPropertyName === "url") {
        replaceWithImport({
          from: `@jsenv/core/helpers/import-meta/import-meta-url-commonjs.js`,
        })
        return
      }
      if (importMetaPropertyName === "resolve") {
        throw createParseError({
          message: `import.meta.resolve() not supported with commonjs format`,
        })
      }
      replaceWithValue(undefined)
      return
    }
    if (importMetaFormat === "global") {
      if (importMetaPropertyName === "url") {
        replaceWithImport({
          from: `@jsenv/core/helpers/import-meta/import-meta-url-global.js`,
        })
        return
      }
      if (importMetaPropertyName === "resolve") {
        throw createParseError({
          message: `import.meta.resolve() not supported with global format`,
        })
      }
      replaceWithValue(undefined)
      return
    }
  }

  return {
    name: "transform-import-meta",

    pre: (state) => {
      babelState = state
    },

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
          visitImportMetaProperty({
            importMetaPropertyName,
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
                value === undefined
                  ? "undefined"
                  : value === null
                  ? "null"
                  : JSON.stringify(value),
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
