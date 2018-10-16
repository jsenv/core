import { JSON_FILE } from "./cache.js"
import { resolvePath } from "./helpers.js"
import path from "path"

export const getCompileRelativeLocation = ({ compiledFolder, file }) => {
  return resolvePath(compiledFolder, file)
}

export const getCacheFolderLocation = ({ root, cacheFolder, file }) => {
  return resolvePath(root, cacheFolder, file)
}

export const getCacheDataLocation = (param) => {
  return resolvePath(getCacheFolderLocation(param), JSON_FILE)
}

export const getBranchRelativeLocation = ({ cacheFolder, branch, file }) => {
  return resolvePath(cacheFolder, file, branch.name)
}

export const getOutputRelativeLocation = ({ file, ...rest }) => {
  return resolvePath(getBranchRelativeLocation({ file, ...rest }), path.basename(file))
}

export const getBranchLocation = ({ root, ...rest }) => {
  return resolvePath(root, getBranchRelativeLocation(rest))
}

export const getOutputLocation = ({ root, ...rest }) => {
  return resolvePath(root, getOutputRelativeLocation(rest))
}

export const getOutputAssetLocation = ({ asset, ...rest }) => {
  return resolvePath(getBranchLocation(rest), asset.name)
}

export const getSourceAbstractLocation = ({ root, file }) => resolvePath(root, file)
