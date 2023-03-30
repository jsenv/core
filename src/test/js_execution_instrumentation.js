import { applyBabelPlugins } from "@jsenv/ast"

export const instrumentJsExecution = async ({
  code,
  url,
  isJsModule = true,
}) => {
  const result = await applyBabelPlugins({
    urlInfo: {
      content: code,
      originalUrl: url,
      type: isJsModule ? "js_module" : "js_classic",
    },
    babelPlugins: isJsModule
      ? [babelPluginJsModuleExecutionInstrumenter]
      : [babelPluginJsClassicExecutionInstrumenter],
  })
  return result.code
}

const babelPluginJsModuleExecutionInstrumenter = (babel) => {
  const t = babel.types

  return {
    name: "js-module-execution-instrumenter",
    visitor: {
      Program: (programPath, state) => {
        if (state.file.metadata.jsExecutionInstrumented) return
        state.file.metadata.jsExecutionInstrumented = true

        const reportStartNode = createReportCall({
          t,
          methodName: "reportJsModuleStart",
        })
        const reportEndNode = createReportCall({
          t,
          methodName: "reportJsModuleEnd",
        })
        const reportErrorNode = createReportCall({
          t,
          methodName: "reportJsModuleError",
          args: [t.identifier("e")],
        })

        const bodyPath = programPath.get("body")
        const importNodes = []
        const topLevelNodes = []
        for (const topLevelNodePath of bodyPath) {
          const topLevelNode = topLevelNodePath.node
          if (
            t.isImportDeclaration(topLevelNode) ||
            t.isImportDefaultSpecifier(topLevelNode) ||
            t.isImportNamespaceSpecifier(topLevelNode) ||
            t.isImportSpecifier(topLevelNode)
          ) {
            importNodes.push(topLevelNode)
          } else {
            topLevelNodes.push(topLevelNode)
          }
        }
        const tryCatchNode = t.tryStatement(
          t.blockStatement([...topLevelNodes, reportEndNode]),
          t.catchClause(t.identifier("e"), t.blockStatement([reportErrorNode])),
        )
        programPath.replaceWith(
          t.program([
            // prettier-ignore-next
            reportStartNode,
            ...importNodes,
            tryCatchNode,
          ]),
        )
      },
    },
  }
}

const babelPluginJsClassicExecutionInstrumenter = (babel) => {
  const t = babel.types

  return {
    name: "js-module-instrumenter",
    visitor: {
      Program: (programPath, state) => {
        if (state.file.metadata.jsExecutionInstrumented) return
        state.file.metadata.jsExecutionInstrumented = true

        const reportStartNode = createReportCall({
          t,
          methodName: "reportJsClassicStart",
        })
        const reportEndNode = createReportCall({
          t,
          methodName: "reportJsClassicEnd",
        })
        const reportErrorNode = createReportCall({
          t,
          methodName: "reportJsClassicError",
          args: [t.identifier("e")],
        })

        const topLevelNodes = programPath.node.body
        const tryCatchNode = t.tryStatement(
          t.blockStatement([...topLevelNodes, reportEndNode]),
          t.catchClause(t.identifier("e"), t.blockStatement([reportErrorNode])),
        )

        programPath.replaceWith(t.program([reportStartNode, tryCatchNode]))
      },
    },
  }
}

const createReportCall = ({ t, methodName, args = [] }) => {
  return t.expressionStatement(
    t.callExpression(
      t.memberExpression(t.identifier("window"), t.identifier(methodName)),
      [
        t.memberExpression(
          t.memberExpression(t.identifier("import"), t.identifier("meta")),
          t.identifier("url"),
        ),
        ...args,
      ],
    ),
    [],
    null,
  )
}
