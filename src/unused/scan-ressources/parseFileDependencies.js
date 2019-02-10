import { transformAsync } from "@babel/core"
import syntaxDynamicImport from "@babel/plugin-syntax-dynamic-import"
import syntaxImportMeta from "@babel/plugin-syntax-import-meta"
import { fileRead } from "@dmail/helper"
import { createCancellationToken, createOperation } from "@dmail/cancellation"

export const parseFileDependencies = async ({
  cancellationToken = createCancellationToken(),
  file,
}) => {
  const code = await createOperation({
    cancellationToken,
    start: () => fileRead(file),
  })

  const dependencies = []

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
  const foundUnpredictableStaticSpecifierAndStaticFile = ({ specifier, specifierFile }) => {
    dependencies.push({
      type: "unpredictable-static",
      specifier,
      specifierFile,
    })
  }

  const foundStaticSpecifierAndStaticFile = ({ specifier, specifierFile }) => {
    dependencies.push({
      type: "static",
      specifier,
      specifierFile,
    })
  }

  const foundStaticSpecifierAndDynamicFile = ({ specifier, specifierFile }) => {
    dependencies.push({
      type: "dynamic-file",
      specifier,
      specifierFile,
    })
  }

  const foundDynamicSpecifierAndStaticFile = ({ specifier, specifierFile }) => {
    dependencies.push({
      type: "dynamic-specifier",
      specifier,
      specifierFile,
    })
  }

  const foundDynamicSpecifierAndDynamicFile = ({ specifier, specifierFile }) => {
    dependencies.push({
      type: "dynamic-specifier-and-dynamic-file",
      specifier,
      specifierFile,
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
        specifierFile: state.filename,
      })
    },

    // export * from './file.js'
    ExportAllDeclaration(path, state) {
      foundStaticSpecifierAndStaticFile({
        specifier: nodeToStaticValue(path.node.source),
        specifierFile: state.filename,
      })
    },

    // export { name } from './file.js'
    ExportNamedDeclaration(path, state) {
      if (!path.node.source) return
      foundStaticSpecifierAndStaticFile({
        specifier: nodeToStaticValue(path.node.source),
        specifierFile: state.filename,
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
      if (staticDependencyInDynamicImportIsPredictable(path)) {
        foundStaticSpecifierAndStaticFile({
          specifier: nodeToStaticValue(firstArg),
          specifierFile: state.filename,
        })
      } else {
        foundUnpredictableStaticSpecifierAndStaticFile({
          specifier: nodeToStaticValue(firstArg),
          specifierFile: state.filename,
        })
      }
    } else {
      foundDynamicSpecifierAndStaticFile({
        specifier: firstArg,
        specifierFile: state.filename,
      })
    }
  }

  const visitDynamicImportTwoArgument = (path) => {
    const firstArg = path.node.arguments[0]
    const secondArg = path.node.arguments[1]
    const firstArgIsStatic = isStaticValue(firstArg)
    const secondArgIsStatic = isStaticValue(secondArg)

    if (firstArgIsStatic && secondArgIsStatic) {
      if (staticDependencyInDynamicImportIsPredictable(path)) {
        foundStaticSpecifierAndStaticFile({
          specifier: nodeToStaticValue(firstArg),
          specifierFile: nodeToStaticValue(secondArg),
        })
      } else {
        foundUnpredictableStaticSpecifierAndStaticFile({
          specifier: nodeToStaticValue(firstArg),
          specifierFile: nodeToStaticValue(secondArg),
        })
      }
    }

    if (firstArgIsStatic && !secondArgIsStatic) {
      foundStaticSpecifierAndDynamicFile({
        specifier: nodeToStaticValue(firstArg),
        specifierFile: secondArg,
      })
    }

    if (!firstArgIsStatic && secondArgIsStatic) {
      foundDynamicSpecifierAndStaticFile({
        specifier: firstArg,
        specifierFile: nodeToStaticValue(secondArg),
      })
    }

    if (!firstArgIsStatic && !secondArgIsStatic) {
      foundDynamicSpecifierAndDynamicFile({
        specifier: firstArg,
        specifierFile: secondArg,
      })
    }
  }

  return {
    visitor,
  }
}

const staticDependencyInDynamicImportIsPredictable = (path) => {
  // https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md#find-a-specific-parent-path
  // https://github.com/babel/babel/blob/045d019149e40fd9424efad445b92a04f5f1f7e4/packages/babel-traverse/src/path/introspection.js#L402
  return path.getStatementParent().parent.type === "Program"
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
