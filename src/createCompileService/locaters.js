import { JSON_FILE } from "./cache.js"
import { resolvePath, normalizeSeparation } from "./helpers.js"
import path from "path"

export const getInputRelativeLocation = ({ abstractFolderRelativeLocation, filename }) => {
  // 'compiled/folder/file.js' -> 'folder/file.js'
  return filename.slice(abstractFolderRelativeLocation.length + 1)
}

export const getCacheFolderLocation = ({ rootLocation, cacheFolderRelativeLocation, ...rest }) => {
  return resolvePath(rootLocation, cacheFolderRelativeLocation, getInputRelativeLocation(rest))
}

export const getCacheDataLocation = (param) => {
  return resolvePath(getCacheFolderLocation(param), JSON_FILE)
}

export const getBranchRelativeLocation = ({ cacheFolderRelativeLocation, branch, ...rest }) => {
  return resolvePath(cacheFolderRelativeLocation, getInputRelativeLocation(rest), branch.name)
}

export const getOutputRelativeLocation = ({ filename, ...rest }) => {
  return resolvePath(getBranchRelativeLocation({ filename, ...rest }), path.basename(filename))
}

export const getBranchLocation = ({ rootLocation, ...rest }) => {
  return resolvePath(rootLocation, getBranchRelativeLocation(rest))
}

export const getOutputLocation = ({ rootLocation, ...rest }) => {
  return resolvePath(rootLocation, getOutputRelativeLocation(rest))
}

export const getOutputAssetLocation = ({ asset, ...rest }) => {
  return resolvePath(getBranchLocation(rest), asset.name)
}

export const getSourceAbstractLocation = ({ rootLocation, inputRelativeLocation }) =>
  resolvePath(rootLocation, inputRelativeLocation)

export const getSourceMapLocation = ({
  rootLocation,
  outputRelativeLocation,
  outputSourceMapName,
}) => resolvePath(rootLocation, path.dirname(outputRelativeLocation), outputSourceMapName)

export const getSourceMapAbstractLocation = ({
  rootLocation,
  abstractFolderRelativeLocation,
  inputRelativeLocation,
  outputSourceMapName,
}) =>
  resolvePath(
    rootLocation,
    abstractFolderRelativeLocation,
    path.dirname(inputRelativeLocation),
    outputSourceMapName,
  )

const sourceMapKnowsExactLocation = false
const sourceMapUseAbsoluteLocation = true

export const getSourceLocationForSourceMap = (context) => {
  if (sourceMapUseAbsoluteLocation) {
    return `/${context.inputRelativeLocation}`
  }

  const sourceLocation = getSourceAbstractLocation(context)
  const sourceMapLocation = sourceMapKnowsExactLocation
    ? getSourceMapLocation(context)
    : getSourceMapAbstractLocation(context)

  return normalizeSeparation(path.relative(path.dirname(sourceMapLocation), sourceLocation))
}
