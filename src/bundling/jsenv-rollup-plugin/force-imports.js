import { relativePathInception } from "../../inception.js"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"

const { addSideEffect } = import.meta.require("@babel/helper-module-imports")

export const createForceImportsBabelPlugin = ({
  projectPathname,
  sideEffectImportRelativePathArray,
}) => {
  sideEffectImportRelativePathArray = sideEffectImportRelativePathArray.map(
    (sideEffectImportRelativePath) =>
      relativePathInception({ projectPathname, relativePath: sideEffectImportRelativePath }),
  )
  const sideEffectImportPathArray = sideEffectImportRelativePathArray.map(
    (sideEffectImportRelativePath) =>
      pathnameToOperatingSystemPath(`${projectPathname}${sideEffectImportRelativePath}`),
  )

  return {
    pre: (file) => {
      const { opts } = file.path.hub.file
      const isFileItself = sideEffectImportPathArray.includes(opts.filename)
      if (isFileItself) return
      sideEffectImportRelativePathArray.forEach((relativePath) => {
        addSideEffect(file.path, relativePath)
      })
    },
  }
}
