import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { getTypePropertyNode } from "@jsenv/core/packages/utils/js_ast/js_ast.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

export const parseAndTransformJsModuleUrls = async (urlInfo, context) => {
  const { rootDirectoryUrl, referenceUtils } = context

  const { metadata } = await applyBabelPlugins({
    babelPlugins: [
      babelPluginMetadataUrlMentions,
      babelPluginMetadataUsesTopLevelAwait,
    ],
    url: urlInfo.data.sourceUrl || urlInfo.url,
    generatedUrl: urlInfo.generatedUrl,
    content: urlInfo.content,
  })
  const { urlMentions, usesTopLevelAwait } = metadata
  urlInfo.data.usesTopLevelAwait = usesTopLevelAwait

  const actions = []
  const magicSource = createMagicSource(urlInfo.content)
  urlMentions.forEach((urlMention) => {
    const [reference, referencedUrlInfo] = referenceUtils.found({
      type: urlMention.type,
      subtype: urlMention.subtype,
      line: urlMention.line,
      column: urlMention.column,
      specifier: urlMention.specifier,
      data: urlMention.data,
      baseUrl: {
        "StringLiteral": urlMention.baseUrl,
        "window.origin": rootDirectoryUrl,
        "import.meta.url": urlInfo.url,
      }[urlMention.baseUrlType],
    })
    if (urlMention.expectedType) {
      referencedUrlInfo.type = urlMention.expectedType
    }
    if (urlMention.expectedSubtype) {
      referencedUrlInfo.subtype = urlMention.expectedSubtype
    }
    actions.push(async () => {
      magicSource.replace({
        start: urlMention.start,
        end: urlMention.end,
        replacement: await referenceUtils.readGeneratedSpecifier(reference),
      })
    })
  })
  await Promise.all(actions.map((action) => action()))
  return magicSource.toContentAndSourcemap()
}

/*
 * see also
 * https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md
 * https://github.com/mjackson/babel-plugin-import-visitor
 *
 */
const babelPluginMetadataUrlMentions = () => {
  return {
    name: "metadata-url-mentions",
    visitor: {
      Program(programPath, state) {
        const urlMentions = []
        const onSpecifier = ({
          type,
          subtype,
          specifierNode,
          expectedType,
          expectedSubtype,
        }) => {
          urlMentions.push({
            type,
            subtype,
            specifier: specifierNode.value,
            expectedType,
            expectedSubtype,
            ...getNodePosition(specifierNode),
          })
        }
        programPath.traverse({
          NewExpression: (path) => {
            const node = path.node
            if (isNewUrlCall(node)) {
              const parentPath = path.parentPath
              const parentNode = parentPath.node
              if (
                parentNode.type === "NewExpression" &&
                isNewWorkerCall(parentNode)
              ) {
                // already found while parsing worker arguments
                return
              }
              visitNewUrlArguments(node, onSpecifier)
            } else if (isNewWorkerCall(node)) {
              visitNewWorkerArguments(node, onSpecifier)
            }
          },
          CallExpression: (path) => {
            if (path.node.callee.type !== "Import") {
              // Some other function call, not import();
              return
            }
            const specifierNode = path.node.arguments[0]
            if (specifierNode.type !== "StringLiteral") {
              // Non-string argument, probably a variable or expression, e.g.
              // import(moduleId)
              // import('./' + moduleName)
              return
            }
            onSpecifier({
              type: "js_import_export",
              subtype: "import_dynamic",
              specifierNode,
              path,
            })
          },
          ExportAllDeclaration: (path) => {
            const specifierNode = path.node.source
            onSpecifier({
              type: "js_import_export",
              subtype: "export_all",
              specifierNode,
              path,
            })
          },
          ExportNamedDeclaration: (path) => {
            const specifierNode = path.node.source
            if (!specifierNode) {
              // This export has no "source", so it's probably
              // a local variable or function, e.g.
              // export { varName }
              // export const constName = ...
              // export function funcName() {}
              return
            }
            onSpecifier({
              type: "js_import_export",
              subtype: "export_named",
              specifierNode,
              path,
            })
          },
          ImportDeclaration: (path) => {
            const specifierNode = path.node.source
            onSpecifier({
              type: "js_import_export",
              subtype: "import_static",
              specifierNode,
              path,
            })
          },
        })
        state.file.metadata.urlMentions = urlMentions
      },
    },
  }
}
const isNewUrlCall = (node) => {
  return node.callee.type === "Identifier" && node.callee.name === "URL"
}
const visitNewUrlArguments = (node, onSpecifier) => {
  if (node.arguments.length === 1) {
    const firstArgNode = node.arguments[0]
    const urlType = analyzeUrlNodeType(firstArgNode)
    if (urlType === "StringLiteral") {
      onSpecifier({
        type: "js_url_specifier",
        subtype: "new_url_first_arg",
        specifierNode: firstArgNode,
      })
    }
  }
  if (node.arguments.length === 2) {
    const firstArgNode = node.arguments[0]
    const secondArgNode = node.arguments[1]
    const baseUrlType = analyzeUrlNodeType(secondArgNode)
    if (baseUrlType) {
      // we can understand the second argument
      const urlType = analyzeUrlNodeType(firstArgNode)
      if (urlType === "StringLiteral") {
        // we can understand the first argument
        onSpecifier({
          type: "js_url_specifier",
          subtype: "new_url_first_arg",
          specifierNode: firstArgNode,
          baseUrlType,
          baseUrl:
            baseUrlType === "StringLiteral" ? secondArgNode.value : undefined,
        })
      }
      if (baseUrlType === "StringLiteral") {
        onSpecifier({
          type: "js_url_specifier",
          subtype: "new_url_second_arg",
          specifierNode: secondArgNode,
        })
      }
    }
  }
}
const analyzeUrlNodeType = (secondArgNode) => {
  if (secondArgNode.type === "StringLiteral") {
    return "StringLiteral"
  }
  if (
    secondArgNode.type === "MemberExpression" &&
    secondArgNode.object.type === "MetaProperty" &&
    secondArgNode.property.type === "Identifier" &&
    secondArgNode.property.name === "url"
  ) {
    return "import.meta.url"
  }
  if (
    secondArgNode.type === "MemberExpression" &&
    secondArgNode.object.type === "Identifier" &&
    secondArgNode.object.name === "window" &&
    secondArgNode.property.type === "Identifier" &&
    secondArgNode.property.name === "origin"
  ) {
    return "window.origin"
  }
  return null
}

const isNewWorkerCall = (node) => {
  return node.callee.type === "Identifier" && node.callee.name === "Worker"
}
const visitNewWorkerArguments = (node, onSpecifier) => {
  let expectedType
  const secondArgNode = node.arguments[1]
  if (secondArgNode) {
    const typePropertyNode = getTypePropertyNode(secondArgNode)
    if (typePropertyNode && typePropertyNode.value.type === "StringLiteral") {
      const typeArgValue = typePropertyNode.value.value
      expectedType =
        typeArgValue === "classic"
          ? "js_classic"
          : typeArgValue === "module"
          ? "js_module"
          : undefined
    }
  }

  const firstArgNode = node.arguments[0]
  if (firstArgNode.type === "StringLiteral") {
    onSpecifier({
      type: "js_url_specifier",
      subtype: "new_worker_first_arg",
      specifierNode: firstArgNode,
      expectedType,
      expectedSubtype: "worker",
    })
  }
  if (firstArgNode.type === "NewExpression" && isNewUrlCall(firstArgNode)) {
    visitNewUrlArguments(firstArgNode, (params) => {
      onSpecifier({
        ...params,
        expectedType,
        expectedSubtype: "worker",
      })
    })
  }
}
const getNodePosition = (node) => {
  return {
    start: node.start,
    end: node.end,
    line: node.loc.start.line,
    column: node.loc.start.column,
    lineEnd: node.loc.end.line,
    columnEnd: node.loc.end.column,
  }
}

const babelPluginMetadataUsesTopLevelAwait = () => {
  return {
    name: "metadata-uses-top-level-await",
    visitor: {
      Program: (programPath, state) => {
        let usesTopLevelAwait = false
        programPath.traverse({
          AwaitExpression: (awaitPath) => {
            const closestFunction = awaitPath.getFunctionParent()
            if (!closestFunction) {
              usesTopLevelAwait = true
              awaitPath.stop()
            }
          },
        })
        state.file.metadata.usesTopLevelAwait = usesTopLevelAwait
      },
    },
  }
}
