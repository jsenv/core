/*
https://github.com/dmail/task-and-more/blob/629d37f30ea0ab7573b14816012dba3ddc78bfdf/packages/compile/parse/babel-plugin-parse-ressources/create-parse-ressources.js#L1

https://astexplorer.net/
*/
import { transformAsync } from "@babel/core"
import syntaxDynamicImport from "@babel/plugin-syntax-dynamic-import"
import syntaxImportMeta from "@babel/plugin-syntax-import-meta"
import { fileRead } from "@dmail/helper"

export const parseImport = async ({ file }) => {
  debugger
  const code = await fileRead(file)
  // const { ast } = await transformAsync(code, babelOptions)

  const staticImport = []
  const dynamicImport = []

  const babelOptions = {
    filename: file,
    babelrc: false,
    ast: true,
    sourceMaps: false,
    sourceFileName: file,
    // https://babeljs.io/docs/en/options#parseropts
    parserOpts: {
      allowAwaitOutsideFunction: true,
    },
    plugins: [
      syntaxDynamicImport,
      syntaxImportMeta,
      createParseImportBabelPlugin({ staticImport, dynamicImport }),
    ],
  }

  await transformAsync(code, babelOptions)

  // so what here ?
}

const createParseImportBabelPlugin = ({ staticImport, dynamicImport }) => {
  const visitor = {
    // import './file.js'
    // import foo from './file.js'
    // import { name } from './file.js'
    // import { a, b } from './file.js'
    // import { c as d } from './file.js'
    // import e, * as f from './file.js'
    // import g, { h } from './file.js'
    ImportDeclaration(node) {
      staticImport.push({
        source: nodeToStaticValue(node.source),
      })
    },

    // export * from './file.js'
    ExportAllDeclaration(node) {
      staticImport.push({
        source: nodeToStaticValue(node.source),
      })
    },

    // export { name } from './file.js'
    ExportNamedDeclaration(node) {
      if (!node.source) return
      staticImport.push({
        source: nodeToStaticValue(node.source),
      })
    },

    // import('./file.js') -> static source
    // import('./file.js', 'from-here') -> static source
    // import('./file.js', import.meta.url) -> dynamic source
    // import(file) -> dynamic-source
    CallExpression(node) {
      const { expression } = node
      debugger
      if (expression.callee.type !== "ImportKeyword") return
      const firstArg = expression.arguments[0]
      const firstArgIsStatic = isStaticValue(firstArg)
      const hasOnlyOneArg = expression.arguments.length === 1

      const secondArg = expression.arguments[1]
      const secondArgIsStatic = hasOnlyOneArg ? null : isStaticValue(secondArg)

      if (hasOnlyOneArg) {
        if (firstArgIsStatic) {
          dynamicImport.push({
            type: "static-source",
            source: nodeToStaticValue(firstArg),
            context: null, // should be the file itself
          })
          return
        }

        dynamicImport.push({
          type: "dynamic-source",
          source: firstArg,
          context: null, // should be the file itself
        })
        return
      }

      if (firstArgIsStatic && secondArgIsStatic) {
        dynamicImport.push({
          type: "static-source",
          source: nodeToStaticValue(firstArg),
          context: nodeToStaticValue(secondArg),
        })
        return
      }

      if (firstArgIsStatic && !secondArgIsStatic) {
        dynamicImport.push({
          type: "dynamic-source",
          source: nodeToStaticValue(firstArg),
          context: secondArg,
        })
        return
      }

      if (!firstArgIsStatic && secondArgIsStatic) {
        dynamicImport.push({
          type: "dynamic-source",
          source: firstArg,
          context: nodeToStaticValue(secondArg),
        })
        return
      }

      dynamicImport.push({
        type: "dynamic-source",
        source: firstArg,
        context: secondArg,
      })
    },
  }

  return {
    visitor,
  }
}

const isStaticValue = (node) => {
  if (node.type === "Literal") return true
  if (node.type === "TemplateLiteral") return node.expressions.length === 0
  return false
}

const nodeToStaticValue = (node) => {
  if (node.type === "TemplateLiteral") {
    return node.quasis[0].value.raw
  }
  if (node.type === "Literal") {
    return node.value
  }
  return null
}
