import { pathToFileURL } from "node:url"

import { injectImport } from "@jsenv/core/omega/internal/js_ast/babel_utils.js"

export const babelPluginRegeneratorRuntimeAsJsenvImport = () => {
  return {
    name: "regenerator-runtime-as-jsenv-import",
    visitor: {
      Identifier(path, opts) {
        const { filename } = opts
        const fileUrl = pathToFileURL(filename)
        if (
          fileUrl.endsWith("/regenerator_runtime/client/regenerator_runtime.js")
        ) {
          return
        }
        const { node } = path
        if (node.name === "regeneratorRuntime") {
          injectImport({
            programPath: path.scope.getProgramParent().path,
            from: "@jsenv/core/omega/plugins/babel/regenerator_runtime/client/regenerator_runtime.js",
            sideEffect: true,
          })
        }
      },
    },
  }
}
