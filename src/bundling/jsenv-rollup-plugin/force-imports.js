const { addSideEffect } = import.meta.require("@babel/helper-module-imports")

export const createForceImportsBabelPlugin = ({ sideEffectImportArray }) => {
  return {
    pre: (file) => {
      const { opts } = file.path.hub.file
      const isFileItself = sideEffectImportArray.some(
        ({ filesystemPath }) => filesystemPath === opts.filename,
      )
      if (isFileItself) return
      sideEffectImportArray.forEach(({ facadePath }) => {
        addSideEffect(file.path, facadePath)
      })
    },
  }
}
