import { pathnameToDirname } from "@jsenv/module-resolution"

export const getCacheFilename = ({ projectFolder, compiledFilenameRelative }) =>
  `${projectFolder}/${compiledFilenameRelative}__asset__/cache.json`

// the fact an asset filename is relative to projectFolder + compiledFilenameRelative
// is strange considering a source filename is relative to projectFolder
// I think it would make more sense to make them relative to the cache.json
// file itself but that's for later
export const getAssetFilename = ({ projectFolder, compiledFilenameRelative, asset }) =>
  `${projectFolder}/${pathnameToDirname(compiledFilenameRelative)}/${asset}`

export const getCompiledFilename = ({ projectFolder, compiledFilenameRelative }) =>
  `${projectFolder}/${compiledFilenameRelative}`

export const getSourceFilename = ({ projectFolder, sourceFilenameRelative }) =>
  `${projectFolder}/${sourceFilenameRelative}`
