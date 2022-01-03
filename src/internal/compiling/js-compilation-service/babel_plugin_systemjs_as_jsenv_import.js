import { require } from "@jsenv/core/src/internal/require.js"

export const babelPluginSystemJsAsJsenvImport = (api, options) => {
  const { addSideEffect } = require("@babel/helper-module-imports")
  api.assertVersion(7)
  const { systemjsImportPath = "@jsenv/core/src/internal/runtime/s.js" } =
    options
  return {
    name: "systemjs-as-jsenv-import",
    visitor: {
      Identifier(path) {
        addSideEffect(path.scope.getProgramParent().path, systemjsImportPath)
      },
    },
  }
}
