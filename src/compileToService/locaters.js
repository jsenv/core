import { resolvePath } from "./helpers.js"

export const getMetaFilename = ({ rootname, compileInto, compileId, filenameRelative }) => {
  return resolvePath(rootname, compileInto, compileId, `${filenameRelative}__asset__`, "meta.json")
}

export const getAssetFilename = ({ rootname, compileInto, compileId, filenameRelative, asset }) => {
  return resolvePath(rootname, compileInto, compileId, `${filenameRelative}__asset__`, asset)
}

export const getOutputFilename = ({ rootname, compileInto, compileId, filenameRelative }) => {
  return resolvePath(rootname, compileInto, compileId, filenameRelative)
}

export const getOutputFilenameRelative = ({ compileInto, compileId, filenameRelative }) => {
  return resolvePath(compileInto, compileId, filenameRelative)
}
