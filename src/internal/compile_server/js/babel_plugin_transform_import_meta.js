// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

import { require } from "@jsenv/core/src/internal/require.js"

import { createParseError } from "./babel_parse_error.js"

export const babelPluginTransformImportMeta = (babel, { importMetaFormat }) => {
  let babelState
  const astFromValue = (value) => {
    const { parseExpression } = require("@babel/parser")
    const valueAst = parseExpression(
      value === undefined
        ? "undefined"
        : value === null
        ? "null"
        : JSON.stringify(value),
      babelState.parserOpts,
    )
    return valueAst
  }

  const visitImportMetaProperty = ({
    programPath,
    importMetaPropertyName,
    replace,
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
        replace(
          generateImportAst({
            programPath,
            from: `@jsenv/core/helpers/import_meta/import_meta_url_commonjs.js`,
          }),
        )
        return
      }
      if (importMetaPropertyName === "resolve") {
        throw createParseError({
          message: `import.meta.resolve() not supported with commonjs format`,
        })
      }
      replace(astFromValue(undefined))
      return
    }
    if (importMetaFormat === "global") {
      if (importMetaPropertyName === "url") {
        replace(
          generateImportAst({
            programPath,
            from: `@jsenv/core/helpers/import_meta/import_meta_url_global.js`,
          }),
        )
        return
      }
      if (importMetaPropertyName === "resolve") {
        throw createParseError({
          message: `import.meta.resolve() not supported with global format`,
        })
      }
      replace(astFromValue(undefined))
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
            programPath,
            importMetaPropertyName,
            replace: (ast) => {
              metaPropertyPathMap[importMetaPropertyName].forEach((path) => {
                path.replaceWith(ast)
              })
            },
          })
        })
      },
    },
  }
}

const generateImportAst = ({
  programPath,
  namespace,
  name,
  from,
  nameHint,
}) => {
  const {
    addNamespace,
    addDefault,
    addNamed,
  } = require("@babel/helper-module-imports")

  if (namespace) {
    return addNamespace(programPath, from, {
      nameHint,
    })
  }
  if (name) {
    return addNamed(programPath, name, from)
  }
  return addDefault(programPath, from, {
    nameHint,
  })
}
