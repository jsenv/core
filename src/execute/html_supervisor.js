import {
  applyBabelPlugins,
  parseHtmlString,
  stringifyHtmlAst,
  visitHtmlNodes,
  getHtmlNodeText,
  getHtmlNodePosition,
  analyzeScriptNode,
  setHtmlNodeAttributes,
  setHtmlNodeText,
  getHtmlNodeAttribute,
} from "@jsenv/ast"
import {
  urlToExtension,
  generateInlineContentUrl,
  urlToFilename,
} from "@jsenv/urls"

import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js"

export const superviseHtml = async ({ code, url, isJsModule = true }) => {
  const extension = urlToExtension(url)
  if (extension === ".html") {
    return instrumentHtml({
      code,
      url,
    })
  }
  return instrumentJsFileExecution({
    code,
    url,
    isJsModule,
  })
}

const instrumentHtml = async ({ code, url }) => {
  const htmlAst = parseHtmlString(code)
  const mutations = []
  const actions = []

  const handleInlineScript = (
    scriptNode,
    { type, contentType, extension, textContent },
  ) => {
    const { line, column, lineEnd, columnEnd } = getHtmlNodePosition(
      scriptNode,
      {
        preferOriginal: true,
      },
    )
    const inlineScriptUrl = generateInlineContentUrl({
      url,
      extension: extension || CONTENT_TYPE.asFileExtension(contentType),
      line,
      column,
      lineEnd,
      columnEnd,
    })
    let jsInstrumented
    actions.push(async () => {
      const filename = urlToFilename(inlineScriptUrl)
      jsInstrumented = await instrumentJsFileExecution({
        code: textContent,
        url: inlineScriptUrl,
        filename,
        isJsModule: type === "js_module",
      })
    })
    mutations.push(() => {
      setHtmlNodeText(scriptNode, jsInstrumented)
      setHtmlNodeAttributes(scriptNode, {
        "jsenv-cooked-by": "jsenv:js_instrumenter",
        ...(extension
          ? { type: type === "js_module" ? "module" : undefined }
          : {}),
      })
    })
  }
  const handleScriptWithSrc = (scriptNode, { type, src }) => {
    mutations.push(() => {
      if (type === "module") {
        setHtmlNodeText(
          scriptNode,
          `const url = new URL(${JSON.stringify(src)}, import.meta.url);
window.__supervisor__.jsModuleStart(url);
try {
  await import(url);
  window.__supervisor__.jsModuleEnd(url, e);
}
catch(e) {
  window.__supervisor__.jsModuleError(url, e);
}`,
        )
      } else {
        setHtmlNodeText(
          scriptNode,
          `
        `,
        )
        setHtmlNodeAttributes(scriptNode, {
          "jsenv-cooked-by": "jsenv:js_instrumenter",
        })
      }
    })
  }

  visitHtmlNodes(htmlAst, {
    script: (scriptNode) => {
      const { type, contentType, extension } = analyzeScriptNode(scriptNode)
      if (type !== "js_module" && type !== "js_classic") {
        return
      }
      const scriptNodeText = getHtmlNodeText(scriptNode)
      if (scriptNodeText) {
        handleInlineScript(scriptNode, {
          type,
          contentType,
          extension,
          textContent: scriptNodeText,
        })
        return
      }
      const src = getHtmlNodeAttribute(scriptNode, "src")
      if (src) {
        handleScriptWithSrc(scriptNode, { type, src })
        return
      }
    },
  })
  if (actions.length > 0) {
    await Promise.all(actions.map((action) => action()))
  }
  if (mutations.length === 0) {
    return null
  }
  mutations.forEach((mutation) => mutation())
  const htmlModified = stringifyHtmlAst(htmlAst)
  return htmlModified
}

const instrumentJsFileExecution = async ({
  code,
  url,
  filename,
  isJsModule,
}) => {
  const babelPluginJsExecutionInstrumenter = isJsModule
    ? babelPluginJsModuleExecutionInstrumenter
    : babelPluginJsClassicExecutionInstrumenter
  const result = await applyBabelPlugins({
    urlInfo: {
      content: code,
      originalUrl: url,
      type: isJsModule ? "js_module" : "js_classic",
    },
    babelPlugins: [[babelPluginJsExecutionInstrumenter, { filename }]],
  })
  return result.code
}

const babelPluginJsModuleExecutionInstrumenter = (babel) => {
  const t = babel.types

  return {
    name: "js-module-execution-instrumenter",
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

const babelPluginJsClassicExecutionInstrumenter = (babel) => {
  const t = babel.types

  return {
    name: "js-module-instrumenter",
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
