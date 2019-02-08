import { transformAsync } from "@babel/core"
import syntaxDynamicImport from "@babel/plugin-syntax-dynamic-import"
import syntaxImportMeta from "@babel/plugin-syntax-import-meta"
import { fileRead } from "@dmail/helper"
import { createCancellationToken, createOperation } from "@dmail/cancellation"

export const parseRawDependencies = async ({
  cancellationToken = createCancellationToken(),
  root,
  ressource,
}) => {
  const file = `${root}/${ressource}`

  // nice to have try/catch this to throw a better error than node native file not found
  const code = await createOperation({
    cancellationToken,
    start: () => fileRead(file),
  })

  const dependencies = []

  const babelOptions = {
    filename: file,
    filenameRelative: ressource,
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
      createParseDependenciesBabelPlugin({ dependencies }),
    ],
  }

  // const { ast } = await transformAsync(code, babelOptions)
  await createOperation({
    cancellationToken,
    start: () => transformAsync(code, babelOptions),
  })

  return dependencies
}

// https://github.com/dmail/task-and-more/blob/629d37f30ea0ab7573b14816012dba3ddc78bfdf/packages/compile/parse/babel-plugin-parse-ressources/create-parse-ressources.js#L1
// https://astexplorer.net/
// https://github.com/jamiebuilds/babel-handbook/blob/master/translations/nl/plugin-handbook.md#toc-visitors
// https://github.com/babel/babel/blob/master/packages/babel-plugin-transform-block-scoping/src/index.js
const createParseDependenciesBabelPlugin = ({ dependencies }) => {
  const foundStaticSpecifierAndStaticFile = ({ specifier, file }) => {
    dependencies.push({
      type: "static",
      specifier,
      file,
    })
  }

  const foundStaticSpecifierAndDynamicFile = ({ specifier, file }) => {
    dependencies.push({
      type: "dynamic-file",
      specifier,
      file,
    })
  }

  const foundDynamicSpecifierAndStaticFile = ({ specifier, file }) => {
    dependencies.push({
      type: "dynamic-specifier",
      specifier,
      file,
    })
  }

  const foundDynamicSpecifierAndDynamicFile = ({ specifier, file }) => {
    dependencies.push({
      type: "dynamic-specifier-and-dynamic-file",
      specifier,
      file,
    })
  }

  const visitor = {
    // import './file.js'
    // import foo from './file.js'
    // import { name } from './file.js'
    // import { a, b } from './file.js'
    // import { c as d } from './file.js'
    // import e, * as f from './file.js'
    // import g, { h } from './file.js'
    ImportDeclaration(path, state) {
      foundStaticSpecifierAndStaticFile({
        specifier: nodeToStaticValue(path.node.source),
        file: state.filename,
      })
    },

    // export * from './file.js'
    ExportAllDeclaration(path, state) {
      foundStaticSpecifierAndStaticFile({
        specifier: nodeToStaticValue(path.node.source),
        file: state.filename,
      })
    },

    // export { name } from './file.js'
    ExportNamedDeclaration(path, state) {
      if (!path.node.source) return
      foundStaticSpecifierAndStaticFile({
        specifier: nodeToStaticValue(path.node.source),
        file: state.filename,
      })
    },

    // import('./file.js') -> static source
    // import('./file.js', 'from-here') -> static source
    // import('./file.js', import.meta.url) -> dynamic source
    // import(file) -> dynamic-source
    CallExpression(path, state) {
      if (path.node.callee.type === "Import") {
        visitDynamicImport(path, state)
      }
    },
  }

  const visitDynamicImport = (path, state) => {
    if (path.node.arguments.length === 1) {
      visitDynamicImportOneArgument(path, state)
    } else if (path.node.arguments.length === 2) {
      visitDynamicImportTwoArgument(path, state)
    }
  }

  const visitDynamicImportOneArgument = (path, state) => {
    const firstArg = path.node.arguments[0]
    const firstArgIsStatic = isStaticValue(firstArg)

    if (firstArgIsStatic) {
      foundStaticSpecifierAndStaticFile({
        specifier: nodeToStaticValue(firstArg),
        file: state.filename,
      })
    } else {
      foundDynamicSpecifierAndStaticFile({
        specifier: firstArg,
        file: state.filename,
      })
    }
  }

  const visitDynamicImportTwoArgument = (path) => {
    const firstArg = path.node.arguments[0]
    const secondArg = path.node.arguments[1]
    const firstArgIsStatic = isStaticValue(firstArg)
    const secondArgIsStatic = isStaticValue(secondArg)

    if (firstArgIsStatic && secondArgIsStatic) {
      foundStaticSpecifierAndStaticFile({
        specifier: nodeToStaticValue(firstArg),
        file: nodeToStaticValue(secondArg),
      })
    }

    if (firstArgIsStatic && !secondArgIsStatic) {
      foundStaticSpecifierAndDynamicFile({
        specifier: nodeToStaticValue(firstArg),
        file: secondArg,
      })
    }

    if (!firstArgIsStatic && secondArgIsStatic) {
      foundDynamicSpecifierAndStaticFile({
        specifier: firstArg,
        file: nodeToStaticValue(secondArg),
      })
    }

    if (!firstArgIsStatic && !secondArgIsStatic) {
      foundDynamicSpecifierAndDynamicFile({
        specifier: firstArg,
        file: secondArg,
      })
    }
  }

  return {
    visitor,
  }
}

const isStaticValue = (node) => {
  if (node.type === "StringLiteral") return true
  if (node.type === "TemplateLiteral") return node.expressions.length === 0
  return false
}

const nodeToStaticValue = (node) => {
  if (node.type === "TemplateLiteral") {
    return node.quasis[0].value.raw
  }
  if (node.type === "StringLiteral") {
    return node.value
  }
  return null
}
