import { resolveProjectFilename } from "../../resolveProjectFilename.js"

export const getCacheFilename = ({ projectFolder, compiledFilenameRelative }) =>
  `${projectFolder}/${compiledFilenameRelative}__asset__/cache.json`

export const getAssetFilename = ({ projectFolder, compiledFilenameRelative, asset }) =>
  `${projectFolder}/${compiledFilenameRelative}__asset__/${asset}`

export const getCompiledFilename = ({ projectFolder, compiledFilenameRelative }) =>
  `${projectFolder}/${compiledFilenameRelative}`

export const getSourceFilename = ({ projectFolder, sourceFilenameRelative }) => {
  return resolveProjectFilename({ projectFolder, filenameRelative: sourceFilenameRelative })
}
