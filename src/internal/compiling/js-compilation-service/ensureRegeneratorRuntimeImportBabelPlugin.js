import { require } from "../../require.js"

export const ensureRegeneratorRuntimeImportBabelPlugin = (api, options) => {
  const { addSideEffect } = require("@babel/helper-module-imports")

  api.assertVersion(7)

  const {
    regeneratorRuntimeIdentifierName = "regeneratorRuntime",
    regeneratorRuntimeImportPath = "@jsenv/core/helpers/regenerator-runtime/regenerator-runtime.js",
  } = options

  return {
    visitor: {
      Identifier(path, opts) {
        const { filename } = opts
        const filepathname = filename.replace(/\\/g, "/")
        if (filepathname.endsWith("node_modules/regenerator-runtime/runtime.js")) {
          return
        }

        const { node } = path
        if (node.name === regeneratorRuntimeIdentifierName) {
          addSideEffect(path.scope.getProgramParent().path, regeneratorRuntimeImportPath)
        }
      },
    },
  }
}
