import { applyBabelPlugins } from "@jsenv/utils/js_ast/apply_babel_plugins.js"
import { createMagicSource } from "@jsenv/utils/sourcemap/magic_source.js"

export const parseJsModuleUrlMentions = async ({
  url,
  generatedUrl,
  content,
}) => {
  const { metadata } = await applyBabelPlugins({
    babelPlugins: [
      babelPluginMetadataUrlMentions,
      babelPluginMetadataUsesTopLevelAwait,
    ],
    url,
    generatedUrl,
    content,
  })
  const { urlMentions, usesTopLevelAwait } = metadata
  return {
    urlMentions,
    replaceUrls: async (getReplacement) => {
      const magicSource = createMagicSource(content)
      urlMentions.forEach((urlMention) => {
        const replacement = getReplacement(urlMention)
        if (replacement) {
          const { start, end } = urlMention
          magicSource.replace({
            start,
            end,
            replacement,
          })
        }
      })
      return magicSource.toContentAndSourcemap()
    },
    data: {
      usesTopLevelAwait,
    },
  }
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
        const onSpecifier = ({ type, subtype, specifierPath, path }) => {
          const specifierNode = specifierPath.node
          if (specifierNode.type === "StringLiteral") {
            urlMentions.push({
              type,
              subtype,
              path,
              specifier: specifierNode.value,
              ...getNodePosition(specifierNode),
            })
          }
        }
        programPath.traverse({
          NewExpression: (path) => {
            const newUrlCall = parseAsNewUrlCall(path)
            if (newUrlCall) {
              // we must check if it's part of new Worker arguments
              // in order to put expectedType on js_new_url
              // and consider this url as as worker
              onSpecifier({
                type: "js_url_specifier",
                subtype: "new_url_first_arg",
                specifierPath: path.get("arguments")[0],
                path,
              })
            }
          },
          CallExpression: (path) => {
            if (path.node.callee.type !== "Import") {
              // Some other function call, not import();
              return
            }
            if (path.node.arguments[0].type !== "StringLiteral") {
              // Non-string argument, probably a variable or expression, e.g.
              // import(moduleId)
              // import('./' + moduleName)
              return
            }
            onSpecifier({
              type: "js_import_export",
              subtype: "import_dynamic",
              specifierPath: path.get("arguments")[0],
              path,
            })
          },
          ExportAllDeclaration: (path) => {
            onSpecifier({
              type: "js_import_export",
              subtype: "export_all",
              specifierPath: path.get("source"),
              path,
            })
          },
          ExportNamedDeclaration: (path) => {
            if (!path.node.source) {
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
              specifierPath: path.get("source"),
              path,
            })
          },
          ImportDeclaration: (path) => {
            onSpecifier({
              type: "js_import_export",
              subtype: "import_static",
              specifierPath: path.get("source"),
              path,
            })
          },
        })
        state.file.metadata.urlMentions = urlMentions
      },
    },
  }
}
const parseAsNewUrlCall = (path) => {
  const node = path.node
  const { callee } = node
  if (callee.type !== "Identifier") {
    return null
  }
  if (callee.name !== "URL") {
    return null
  }
  const [firstArgument, secondArgument] = node.arguments
  if (firstArgument.type !== "StringLiteral") {
    return null
  }
  if (node.arguments.length === 1) {
    return {
      baseUrl: "document",
    }
  }
  if (secondArgument.object.type !== "MetaProperty") {
    return null
  }
  if (secondArgument.property.type !== "Identifier") {
    return null
  }
  if (secondArgument.property.name !== "url") {
    return null
  }
  return {
    baseUrl: "parent",
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
