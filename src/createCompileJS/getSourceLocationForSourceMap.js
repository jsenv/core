import path from "path"
import { resolvePath, normalizeSeparation } from "../createCompileService/helpers.js"
import { getSourceAbstractLocation } from "../createCompileService/locaters.js"

const sourceMapKnowsExactLocation = false
const sourceMapUseAbsoluteLocation = true

const getSourceMapLocation = ({ rootLocation, outputRelativeLocation, outputSourceMapName }) =>
  resolvePath(rootLocation, path.dirname(outputRelativeLocation), outputSourceMapName)

const getSourceMapAbstractLocation = ({
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
