const { addSideEffect } = import.meta.require("@babel/helper-module-imports")

export const ensureRegeneratorRuntimeImportBabelPlugin = (api, options) => {
  api.assertVersion(7)

  const {
    regeneratorRuntimeIdentifierName = "regeneratorRuntime",
    regeneratorRuntimeImportPath = "regenerator-runtime/runtime",
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
