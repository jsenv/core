import { resolvePath } from "./helpers.js"

export const getMetaFilename = ({ projectFolder, compileInto, compileId, filenameRelative }) => {
  return resolvePath(
    projectFolder,
    compileInto,
    compileId,
    `${filenameRelative}__asset__`,
    "meta.json",
  )
}

export const getAssetFilename = ({
  projectFolder,
  compileInto,
  compileId,
  filenameRelative,
  asset,
}) => {
  return resolvePath(projectFolder, compileInto, compileId, `${filenameRelative}__asset__`, asset)
}

export const getOutputFilename = ({ projectFolder, compileInto, compileId, filenameRelative }) => {
  return resolvePath(projectFolder, compileInto, compileId, filenameRelative)
}

export const getOutputFilenameRelative = ({ compileInto, compileId, filenameRelative }) => {
  return resolvePath(compileInto, compileId, filenameRelative)
}
