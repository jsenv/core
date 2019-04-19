import { pathnameToDirname } from "@jsenv/module-resolution"

export const getCacheFilename = ({ projectFolder, compiledFilenameRelative }) =>
  `${projectFolder}/${compiledFilenameRelative}__asset__/cache.json`

export const getAssetFilename = ({ projectFolder, compiledFilenameRelative, asset }) =>
  `${projectFolder}/${pathnameToDirname(compiledFilenameRelative)}/${asset}`

export const getCompiledFilename = ({ projectFolder, compiledFilenameRelative }) =>
  `${projectFolder}/${compiledFilenameRelative}`

export const getSourceFilename = ({ projectFolder, sourceFilenameRelative }) =>
  `${projectFolder}/${sourceFilenameRelative}`
