import { applyBabelPlugins } from "@jsenv/ast"

export const jsenvPluginImportMetaResolve = () => {
  return {
    name: "jsenv:import_meta_resolve",
    appliesDuring: "*",
    init: (context) => {
      if (context.isSupportedOnCurrentClients("import_meta_resolve")) {
        return false
      }
      const willTransformJsModules =
        !context.isSupportedOnCurrentClients("script_type_module") ||
        !context.isSupportedOnCurrentClients("import_dynamic") ||
        !context.isSupportedOnCurrentClients("import_meta")
      // keep it untouched, systemjs will handle it
      if (willTransformJsModules) {
        return false
      }
      return true
    },
    transformUrlContent: {
      js_module: async (urlInfo, context) => {
        if (!urlInfo.content.includes("import.meta.resolve(")) {
          return null
        }
        const { code, map } = await applyBabelPlugins({
          urlInfo,
          babelPlugins: [
            [
              {
                name: "transform-import-meta-resolve",
                visitor: {
                  Program: (programPath) => {
                    programPath.traverse({
                      CallExpression: (path) => {
                        const node = path.node
                        const callee = node.callee
                        if (
                          callee.type === "MemberExpression" &&
                          callee.object.type === "MetaProperty" &&
                          callee.property.type === "Identifier" &&
                          callee.property.name === "resolve"
                        ) {
                          const firstArg = node.arguments[0]
                          if (firstArg && firstArg.type === "StringLiteral") {
                            const reference = context.referenceUtils.find(
                              (ref) =>
                                ref.subtype === "import_meta_resolve" &&
                                ref.url === firstArg.value,
                            )
                            path.replaceWithSourceString(
                              `new URL(${reference.generatedSpecifier}, window.location).href`,
                            )
                          }
                        }
                      },
                    })
                  },
                },
              },
            ],
          ],
        })
        return {
          content: code,
          sourcemap: map,
        }
      },
    },
  }
}
