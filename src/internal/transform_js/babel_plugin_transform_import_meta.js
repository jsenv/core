// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#toc-stages-of-babel
// https://github.com/cfware/babel-plugin-bundled-import-meta/blob/master/index.js
// https://github.com/babel/babel/blob/f4edf62f6beeab8ae9f2b7f0b82f1b3b12a581af/packages/babel-helper-module-imports/src/index.js#L7

import { require } from "@jsenv/core/src/internal/require.js"

import { createParseError } from "@jsenv/core/src/internal/transform_js/babel_parse_error.js"

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
          from: "@jsenv/core/src/internal/event_source_client/import_meta_hot_module.js",
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
        const {
          decline = false,
          acceptSelf = false,
          acceptDependencies = [],
        } = importMetaProperties.hot || {}
        Object.assign(this.file.metadata, {
          importMetaHotDecline: decline,
          importMetaHotAcceptSelf: acceptSelf,
          importMetaHotAcceptDependencies: acceptDependencies,
        })
      },
    },
  }
}

const collectImportMetaProperties = (programPath) => {
  const importMetaProperties = {}
  const storeImportProperty = (name, props) => {
    importMetaProperties[name] = {
      ...importMetaProperties[name],
      ...props,
    }
  }
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
      if (importMetaProperty && importMetaProperty.paths) {
        importMetaProperty.paths.push(path)
      } else {
        storeImportProperty(name, { paths: [path] })
      }
    },
    CallExpression(path) {
      if (isImportMetaHotMethodCall(path, "accept")) {
        const callNode = path.node
        const args = callNode.arguments
        if (args.length === 0) {
          storeImportProperty("hot", { acceptSelf: true })
          return
        }
        const firstArg = args[0]
        if (firstArg.type === "StringLiteral") {
          storeImportProperty("hot", { acceptDependencies: [firstArg.value] })
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
          storeImportProperty("hot", { acceptDependencies: dependencies })
          return
        }
        // accept first arg can be "anything"
        storeImportProperty("hot", { acceptSelf: true })
      }
      if (isImportMetaHotMethodCall(path, "decline")) {
        storeImportProperty("hot", { decline: true })
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
