import path from "path"
import { resolvePath, normalizeSeparation } from "../createCompileService/helpers.js"
import { getSourceAbstractLocation } from "../createCompileService/locaters.js"

const sourceMapKnowsExactLocation = false
const sourceMapUseAbsoluteLocation = true

const getSourceMapLocation = ({ root, outputRelativeLocation, outputSourceMapName }) =>
  resolvePath(root, path.dirname(outputRelativeLocation), outputSourceMapName)

const getSourceMapAbstractLocation = ({
  root,
  abstractFolderRelativeLocation,
  inputRelativeLocation,
  outputSourceMapName,
}) =>
  resolvePath(
    root,
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
