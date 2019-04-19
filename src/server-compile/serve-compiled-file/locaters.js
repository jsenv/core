// import { filenameRelativeInception } from "../../filenameRelativeInception.js"

export const getCacheFilename = ({ projectFolder, compiledFilenameRelative }) =>
  `${projectFolder}/${compiledFilenameRelative}__asset__/cache.json`

export const getAssetFilename = ({ projectFolder, compiledFilenameRelative, asset }) =>
  `${projectFolder}/${compiledFilenameRelative}__asset__/${asset}`

export const getCompiledFilename = ({ projectFolder, compiledFilenameRelative }) =>
  `${projectFolder}/${compiledFilenameRelative}`

export const getSourceFilename = ({ projectFolder, sourceFilenameRelative }) => {
  // const sourceFilenameRelativeInception = filenameRelativeInception({
  //   projectFolder,
  //   filenameRelative: sourceFilenameRelative,
  // })
  return `${projectFolder}/${sourceFilenameRelative}`
}
