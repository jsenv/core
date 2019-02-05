import { resolvePath } from "./helpers.js"

export const getMetaLocation = ({ localRoot, compileInto, compileId, file }) => {
  return resolvePath(localRoot, compileInto, compileId, `${file}__asset__`, "meta.json")
}

export const getAssetLocation = ({ localRoot, compileInto, compileId, file, asset }) => {
  return resolvePath(localRoot, compileInto, compileId, `${file}__asset__`, asset)
}

export const getOutputLocation = ({ localRoot, compileInto, compileId, file }) => {
  return resolvePath(localRoot, compileInto, compileId, file)
}

export const getOutputFile = ({ compileInto, compileId, file }) => {
  return resolvePath(compileInto, compileId, file)
}
