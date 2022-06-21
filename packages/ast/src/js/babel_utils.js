import { require } from "../require.js"

// https://github.com/babel/babel/tree/master/packages/babel-helper-module-imports
export const injectJsImport = ({
  programPath,
  namespace,
  name,
  from,
  nameHint,
  sideEffect,
}) => {
  const {
    addNamespace,
    addDefault,
    addNamed,
    addSideEffect,
  } = require("@babel/helper-module-imports")

  if (namespace) {
    return addNamespace(programPath, from, {
      nameHint,
    })
  }
  if (name) {
    return addNamed(programPath, name, from)
  }
  if (sideEffect) {
    return addSideEffect(programPath, from)
  }
  return addDefault(programPath, from, {
    nameHint,
  })
}

const generateExpressionAst = (expression, options) => {
  const { parseExpression } = require("@babel/parser")

  const ast = parseExpression(expression, options)
  return ast
}

export const generateValueAst = (value) => {
  const valueAst = generateExpressionAst(
    value === undefined
      ? "undefined"
      : value === null
      ? "null"
      : JSON.stringify(value),
  )
  return valueAst
}

export const injectAstAfterImport = (programPath, ast) => {
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
