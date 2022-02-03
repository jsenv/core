// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

import { require } from "@jsenv/core/src/internal/require.js"

import { createParseError } from "./babel_parse_error.js"

export const babelPluginTransformImportMeta = (
  babel,
  { importMetaFormat, importMetaHot },
) => {
  const visitImportMetaProperty = ({
    programPath,
    importMetaPropertyName,
    replace,
  }) => {
    if (importMetaFormat === "esmodule") {
      if (importMetaHot && importMetaPropertyName === "hot") {
        const importMetaHotAst = injectImport({
          programPath,
          from: "@jsenv/core/src/internal/dev_server/event_source_client/import_meta_hot_module.js",
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
    visitor: {
      Program(programPath) {
        const importMetaProperties = collectImportMetaProperties(programPath)
        Object.keys(importMetaProperties).forEach((key) => {
          visitImportMetaProperty({
            programPath,
            importMetaPropertyName: key,
            replace: (ast) => {
              importMetaProperties[key].paths.forEach((path) => {
                path.replaceWith(ast)
              })
            },
          })
        })
        const importMetaHot = importMetaProperties.hot
        if (importMetaHot) {
          this.file.metadata.importMetaHot = {
            decline: importMetaHot.decline,
            acceptSelf: importMetaHot.acceptSelf,
            acceptDependencies: importMetaHot.acceptDependencies,
          }
        }
      },
    },
  }
}

const collectImportMetaProperties = (programPath) => {
  const importMetaProperties = {}
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

      const importMetaProperty = importMetaProperties[name]
      if (importMetaProperty) {
        importMetaProperty.paths.push(path)
      } else {
        importMetaProperties[name] = {
          paths: [path],
        }
      }
    },
    CallExpression(path) {
      if (isImportMetaHotMethodCall(path, "accept")) {
        const callNode = path.node
        const args = callNode.arguments
        if (args.length === 0) {
          importMetaProperties.hot.acceptSelf = true
          return
        }
        const firstArg = args[0]
        if (firstArg.type === "StringLiteral") {
          importMetaProperties.hot.acceptDependencies = [firstArg.value]
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
          importMetaProperties.hot.acceptDependencies = dependencies
          return
        }
        if (firstArg.type === "ObjectExpression") {
          const dependencies = firstArg.properties.map((property) => {
            if (property.key.type !== "StringLiteral") {
              throw new Error(
                `all object key must be strings in "import.meta.hot.accept(object)"`,
              )
            }
            return property.key.value
          })
          importMetaProperties.hot.acceptDependencies = dependencies
          return
        }
      }
      if (isImportMetaHotMethodCall(path, "decline")) {
        importMetaProperties.hot.decline = true
      }
    },
  })
  return importMetaProperties
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
