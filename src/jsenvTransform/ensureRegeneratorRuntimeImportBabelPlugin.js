const { addSideEffect } = import.meta.require("@babel/helper-module-imports")

export const ensureRegeneratorRuntimeImportBabelPlugin = (api, options) => {
  api.assertVersion(7)

  const {
    regeneratorRuntimeIdentifierName = "regeneratorRuntime",
    regeneratorRuntimeImportPath = "regenerator-runtime/runtime",
  } = options

  return {
    visitor: {
      Identifier(path) {
        const { node } = path
        if (node.name === regeneratorRuntimeIdentifierName) {
          addSideEffect(path.scope.getProgramParent().path, regeneratorRuntimeImportPath)
        }
      },
    },
  }
}
