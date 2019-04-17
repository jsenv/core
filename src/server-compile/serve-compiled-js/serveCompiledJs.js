import { fileRead } from "@dmail/helper"
import { compileJs } from "./compileJs.js"
import { serveCompiledFile } from "../serve-compiled-file/index.js"

export const serveCompiledJs = async ({
  projectFolder,
  compileInto,
  groupMap,
  babelConfigMap,
  transformTopLevelAwait,
  projectFileRequestedCallback,
  origin,
  headers,
  compileId,
  filenameRelative,
}) => {
  const sourceFilenameRelative = filenameRelative
  const compiledFilenameRelative = `${compileInto}/${compileId}/${filenameRelative}`

  projectFileRequestedCallback({
    filenameRelative: sourceFilenameRelative,
    filename: `${projectFolder}/${sourceFilenameRelative}`,
  })

  return serveCompiledFile({
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
