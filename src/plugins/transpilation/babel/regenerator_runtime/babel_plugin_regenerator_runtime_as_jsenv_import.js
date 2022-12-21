import { pathToFileURL } from "node:url"
import { injectJsImport } from "@jsenv/ast"

export const regeneratorRuntimeClientFileUrl = new URL(
  "./client/regenerator_runtime.js",
  import.meta.url,
).href

export const babelPluginRegeneratorRuntimeAsJsenvImport = (
  babel,
  { getImportSpecifier },
) => {
  return {
    name: "regenerator-runtime-as-jsenv-import",
    visitor: {
      Identifier(path, opts) {
        const { filename } = opts
        const fileUrl = pathToFileURL(filename).href
        if (fileUrl === regeneratorRuntimeClientFileUrl) {
          return
        }
        const { node } = path
        if (node.name === "regeneratorRuntime") {
          injectJsImport({
            programPath: path.scope.getProgramParent().path,
            from: getImportSpecifier(regeneratorRuntimeClientFileUrl),
            sideEffect: true,
          })
        }
      },
    },
  }
}
