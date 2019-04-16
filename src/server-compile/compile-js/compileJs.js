import { fileRead } from "@dmail/helper"
import { compileFile } from "../compile-file/index.js"

export const compileJs = async ({
  projectFolder,
  compileInto,
  groupMap,
  babelConfigMap,
  transformTopLevelAwait,
  origin,
  headers,
  compileId,
  filenameRelative,
}) => {
  const sourceFilenameRelative = filenameRelative
  const compiledFilenameRelative = `${compileInto}/${compileId}/${filenameRelative}`

  return compileFile({
    projectFolder,
    sourceFilenameRelative,
    compiledFilenameRelative,
    headers,
    compile: async ({ sourceFilename }) => {
      const source = await fileRead(sourceFilename)
      const groupBabelConfigMap = {}
      groupMap[compileId].incompatibleNameArray.forEach((incompatibleFeatureName) => {
        if (incompatibleFeatureName in babelConfigMap) {
          groupBabelConfigMap[incompatibleFeatureName] = babelConfigMap[incompatibleFeatureName]
        }
      })

      return compileJs({
        projectFolder,
        compileInto,
        compileId,
        filenameRelative: sourceFilenameRelative,
        filename: sourceFilename,
        source,
        babelConfigMap: groupBabelConfigMap,
        transformTopLevelAwait,
        origin,
      })
    },
  })
}
