import { resolvePath } from "./helpers.js"
import path from "path"

export const JSON_FILE = "cache.json"

export const getCompileRelativeLocation = ({ compileFolder, inputName }) => {
  return resolvePath(compileFolder, inputName)
}

export const getCacheFolderLocation = ({ root, cacheFolder, inputName }) => {
  return resolvePath(root, cacheFolder, inputName)
}

export const getCacheDataLocation = (param) => {
  return resolvePath(getCacheFolderLocation(param), JSON_FILE)
}

export const getBranchRelativeLocation = ({ cacheFolder, branch, inputName }) => {
  return resolvePath(cacheFolder, inputName, branch.name)
}

export const getOutputName = ({ inputName, ...rest }) => {
  return resolvePath(getBranchRelativeLocation({ inputName, ...rest }), path.basename(inputName))
}

export const getBranchLocation = ({ root, ...rest }) => {
  return resolvePath(root, getBranchRelativeLocation(rest))
}

export const getOutputLocation = ({ root, ...rest }) => {
  return resolvePath(root, getOutputName(rest))
}

export const getOutputAssetLocation = ({ asset, ...rest }) => {
  return resolvePath(getBranchLocation(rest), asset.name)
}
