import { applyBabelPlugins } from "@jsenv/ast"

export const instrumentTopLevelAwait = async ({ code, url }) => {
  const result = await applyBabelPlugins({
    urlInfo: {
      content: code,
      originalUrl: url,
    },
    babelPlugins: [babelPluginTopLevelAwaitWrapper],
  })
  return result.code
}

const babelPluginTopLevelAwaitWrapper = (babel) => {
  const t = babel.types

  return {
    name: "top-level-await-wrapper",
    visitor: {
      Program: (path) => {
        // check if this program contains top-level awaits
        // or if it contains exports (which aren't supported)
        let has_export = false
        let has_top_level_await = false

        path.traverse({
          AwaitExpression(path) {
            const closestFunction = path.getFunctionParent()
            if (!closestFunction || closestFunction.type === "Program") {
              has_top_level_await = true
            }
          },
          ExportDeclaration(path) {
            has_export = true
            path.stop()
          },
          ExportNamespaceSpecifier(path) {
            has_export = true
            path.stop()
          },
          ExportSpecifier(path) {
            has_export = true
            path.stop()
          },
          ExportDefaultSpecifier(path) {
            has_export = true
            path.stop()
          },
        })

        if (has_export) {
          throw new SyntaxError(
            "Cannot instrument top level await when there is exports",
          )
        }
        if (!has_top_level_await) {
          return
        }

        const imports = []
        const topLevelStatements = []
        path.node.body.forEach((node) => {
          // hoist import statements
          if (
            t.isImportDeclaration(node) ||
            t.isImportDefaultSpecifier(node) ||
            t.isImportNamespaceSpecifier(node) ||
            t.isImportSpecifier(node)
          ) {
            imports.push(node)
          } else {
            topLevelStatements.push(node)
          }
        })

        path.replaceWith(
          t.program([
            ...imports,
            t.expressionStatement(
              t.callExpression(
                t.memberExpression(
                  t.identifier("window"),
                  t.identifier("reportJsModuleExecution"),
                ),
                [
                  // TODO: put import.meta.url here
                  t.callExpression(
                    t.arrowFunctionExpression(
                      [],
                      t.blockStatement(topLevelStatements),

                      true, // async
                    ),
                    [],
                  ),
                ],
              ),
              [],
              null,
            ),
          ]),
        )
      },
    },
  }
}
