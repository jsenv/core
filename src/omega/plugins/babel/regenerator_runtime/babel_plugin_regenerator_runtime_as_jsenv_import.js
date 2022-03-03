import { pathToFileURL } from "node:url"

import { injectImport } from "@jsenv/core/src/utils/js_ast/babel_utils.js"

export const babelPluginRegeneratorRuntimeAsJsenvImport = () => {
  const regeneratorRuntimeClientFileUrl = new URL(
    "./client/regenerator_runtime.js",
    import.meta.url,
  ).href

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
          injectImport({
            programPath: path.scope.getProgramParent().path,
            from: regeneratorRuntimeClientFileUrl,
            sideEffect: true,
          })
        }
      },
    },
  }
}
