export const getCacheFilename = ({ projectFolder, compileInto, compileId, filenameRelative }) =>
  `${projectFolder}/${compileInto}/${compileId}/${filenameRelative}__asset__/cache.json`

export const getAssetFilename = ({
  projectFolder,
  compileInto,
  compileId,
  filenameRelative,
  asset,
}) => `${projectFolder}/${compileInto}/${compileId}/${filenameRelative}__asset__/${asset}`

export const getCompiledFilename = ({ projectFolder, compileInto, compileId, filenameRelative }) =>
  `${projectFolder}/${compileInto}/${compileId}/${filenameRelative}`

export const getCompiledFilenameRelative = ({ compileInto, compileId, filenameRelative }) =>
  `${compileInto}/${compileId}/${filenameRelative}`
