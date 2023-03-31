import { applyBabelPlugins } from "@jsenv/ast"

export const injectSupervisorIntoJs = async ({
  content,
  url,
  filename,
  isJsModule,
}) => {
  const babelPluginJsSupervisor = isJsModule
    ? babelPluginJsModuleSupervisor
    : babelPluginJsClassicSupervisor
  const result = await applyBabelPlugins({
    urlInfo: {
      content,
      originalUrl: url,
      type: isJsModule ? "js_module" : "js_classic",
    },
    babelPlugins: [[babelPluginJsSupervisor, { filename }]],
  })
  return result.code
}

const babelPluginJsModuleSupervisor = (babel) => {
  const t = babel.types

  return {
    name: "js-module-supervisor",
    visitor: {
      Program: (programPath, state) => {
        const { filename } = state.opts
        if (state.file.metadata.jsExecutionInstrumented) return
        state.file.metadata.jsExecutionInstrumented = true

        const urlNode = createJsModuleUrlNode(t, filename)
        const startCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleStart",
        })
        const endCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleEnd",
        })
        const errorCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsModuleError",
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
          t.blockStatement([...topLevelNodes, endCallNode]),
          t.catchClause(t.identifier("e"), t.blockStatement([errorCallNode])),
        )
        programPath.replaceWith(
          t.program([
            // prettier-ignore-next
            startCallNode,
            ...importNodes,
            tryCatchNode,
          ]),
        )
      },
    },
  }
}

const babelPluginJsClassicSupervisor = (babel) => {
  const t = babel.types

  return {
    name: "js-classic-supervisor",
    visitor: {
      Program: (programPath, state) => {
        const { filename } = state.opts
        if (state.file.metadata.jsExecutionInstrumented) return
        state.file.metadata.jsExecutionInstrumented = true

        const urlNode = createJsClassicUrlNode(t, filename)
        const startCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicStart",
        })
        const endCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicEnd",
        })
        const errorCallNode = createSupervisionCall({
          t,
          urlNode,
          methodName: "jsClassicError",
          args: [t.identifier("e")],
        })

        const topLevelNodes = programPath.node.body
        const tryCatchNode = t.tryStatement(
          t.blockStatement([...topLevelNodes, endCallNode]),
          t.catchClause(t.identifier("e"), t.blockStatement([errorCallNode])),
        )

        programPath.replaceWith(t.program([startCallNode, tryCatchNode]))
      },
    },
  }
}

const createJsModuleUrlNode = (t, filename) => {
  const importMetaUrlNode = t.memberExpression(
    t.memberExpression(t.identifier("import"), t.identifier("meta")),
    t.identifier("url"),
  )
  if (filename) {
    const urlIdentifier = t.identifier("URL")
    const firstArg = t.stringLiteral(filename)
    const newExpression = t.newExpression(urlIdentifier, [
      firstArg,
      importMetaUrlNode,
    ])
    return newExpression
  }
  return importMetaUrlNode
}

const createJsClassicUrlNode = (t, filename) => {
  const documentCurrentScriptSrcNode = t.memberExpression(
    t.memberExpression(t.identifier("document"), t.identifier("currentScript")),
    t.identifier("src"),
  )
  if (filename) {
    const newUrlNode = t.newExpression(t.identifier("URL"), [
      t.stringLiteral(filename),
      documentCurrentScriptSrcNode,
    ])
    return newUrlNode
  }
  return documentCurrentScriptSrcNode
}

const createSupervisionCall = ({ t, methodName, urlNode, args = [] }) => {
  return t.expressionStatement(
    t.callExpression(
      t.memberExpression(
        t.memberExpression(
          t.identifier("window"),
          t.identifier("__supervisor__"),
        ),
        t.identifier(methodName),
      ),
      [urlNode, ...args],
    ),
    [],
    null,
  )
}
