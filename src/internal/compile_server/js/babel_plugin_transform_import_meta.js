// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

import { require } from "@jsenv/core/src/internal/require.js"

import { createParseError } from "./babel_parse_error.js"

export const babelPluginTransformImportMeta = (babel, { importMetaFormat }) => {
  const visitImportMetaProperty = ({
    programPath,
    importMetaPropertyName,
    replace,
  }) => {
    if (importMetaFormat === "esmodule") {
      if (importMetaPropertyName === "hot") {
        const importMetaHotAst = injectImport({
          programPath,
          from: "@jsenv/core/helpers/import_meta/import_meta_hot_module.js",
          nameHint: `createImportMetaHot`,
          // disable interop, useless as we work only with js modules
          importedType: "es6",
          // importedInterop: "uncompiled",
        })
        const ast = babel.parse(
          `import.meta.hot = ${importMetaHotAst.name}(import.meta.url)`,
        )
        injectAstAfterImport(programPath, ast.program.body[0])
      }
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
          injectImport({
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
      replace(generateValueAst(undefined))
      return
    }
    if (importMetaFormat === "global") {
      if (importMetaPropertyName === "url") {
        replace(
          injectImport({
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
      replace(generateValueAst(undefined))
      return
    }
  }

  return {
    name: "transform-import-meta",

    // pre(babel) {
    //   parserOpts = babel.opts.parserOpts
    // },

    visitor: {
      Program(programPath) {
        const importMetaHotPaths = []
        traverseImportMetaProperties(programPath, ({ name, path }) => {
          if (name === "hot") {
            importMetaHotPaths.push(path)
          }
        })
        if (importMetaHotPaths.length) {
          visitImportMetaProperty({
            programPath,
            importMetaPropertyName: "hot",
            replace: (ast) => {
              importMetaHotPaths.forEach((path) => {
                path.replaceWith(ast)
              })
            },
          })
        }
        const importMetaProperties = {}
        traverseImportMetaProperties(programPath, ({ name, path }) => {
          if (name === "hot") {
            return
          }
          const paths = importMetaProperties[name]
          if (paths) {
            paths.push(path)
          } else {
            importMetaProperties[name] = [path]
          }
        })
        Object.keys(importMetaProperties).forEach((key) => {
          visitImportMetaProperty({
            programPath,
            importMetaPropertyName: key,
            replace: (ast) => {
              importMetaProperties[key].forEach((path) => {
                path.replaceWith(ast)
              })
            },
          })
        })
      },
    },
  }
}

const traverseImportMetaProperties = (programPath, callback) => {
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
      callback({ name, path })
    },
  })
}

const generateExpressionAst = (expression, options) => {
  const { parseExpression } = require("@babel/parser")

  const ast = parseExpression(expression, options)
  return ast
}

const generateValueAst = (value) => {
  const valueAst = generateExpressionAst(
    value === undefined
      ? "undefined"
      : value === null
      ? "null"
      : JSON.stringify(value),
  )
  return valueAst
}

const injectAstAfterImport = (programPath, ast) => {
  const bodyNodePaths = programPath.get("body")
  const notAnImportIndex = bodyNodePaths.findIndex(
    (bodyNodePath) => bodyNodePath.node.type !== "ImportDeclaration",
  )
  const notAnImportNodePath = bodyNodePaths[notAnImportIndex]
  if (notAnImportNodePath) {
    notAnImportNodePath.insertBefore(ast)
  } else {
    bodyNodePaths[0].insertBefore(ast)
  }
}

const injectImport = ({ programPath, namespace, name, from, nameHint }) => {
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
