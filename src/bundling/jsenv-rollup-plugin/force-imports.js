const { addSideEffect } = import.meta.require("@babel/helper-module-imports")

export const createForceImportsBabelPlugin = ({ sideEffectImportRelativePathArray }) => {
  return {
    pre: (file) => {
      const { opts } = file.path.hub.file
      const isFileItself = sideEffectImportRelativePathArray.some(
        (relativePath) => relativePath.slice(1) === opts.filenameRelative,
      )
      if (isFileItself) return
      sideEffectImportRelativePathArray.forEach((relativePath) => {
        addSideEffect(file.path, relativePath)
      })
    },
  }
}
