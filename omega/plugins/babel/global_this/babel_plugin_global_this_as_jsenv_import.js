import { pathToFileURL } from "node:url"

import { injectImport } from "@jsenv/core/omega/internal/js_ast/babel_utils.js"

export const babelPluginGlobalThisAsJsenvImport = () => {
  return {
    name: "global-this-as-jsenv-import",
    visitor: {
      Identifier(path, opts) {
        const { filename } = opts
        const fileUrl = pathToFileURL(filename).href
        if (fileUrl.endsWith("/global_this/client/global_this.js")) {
          return
        }
        const { node } = path
        // we should do this once, tree shaking will remote it but still
        if (node.name === "globalThis") {
          injectImport({
            programPath: path.scope.getProgramParent().path,
            from: "@jsenv/core/omega/plugins/babel/global_this/client/global_this.js",
            sideEffect: true,
          })
        }
      },
    },
  }
}
