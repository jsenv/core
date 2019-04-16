export const getCacheFilename = ({ projectFolder, filenameRelative }) =>
  `${projectFolder}/${filenameRelative}__asset__/cache.json`

export const getAssetFilename = ({ projectFolder, filenameRelative, asset }) =>
  `${projectFolder}/${filenameRelative}__asset__/${asset}`

export const getCompiledFilename = ({ projectFolder, filenameRelative }) =>
  `${projectFolder}/${filenameRelative}`

export const getCompiledFilenameRelative = ({ filenameRelative }) => `${filenameRelative}`
