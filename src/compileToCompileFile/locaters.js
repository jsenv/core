import { resolvePath } from "./helpers.js"

export const getMetaLocation = ({ root, into, compileId, file }) => {
  return resolvePath(root, into, compileId, `${file}__meta__`, "meta.json")
}

export const getAssetLocation = ({ root, into, compileId, file, asset }) => {
  return resolvePath(root, into, compileId, `${file}__meta__`, asset)
}

export const getOutputLocation = ({ root, into, compileId, file }) => {
  return resolvePath(root, into, compileId, file)
}

export const getOutputName = ({ into, compileId, file }) => {
  return resolvePath(into, compileId, file)
}
