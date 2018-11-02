import { objectFilter } from "../../objectHelper.js"

const writeSourceMapLocation = ({ source, location }) => {
  return `${source}
${"//#"} sourceMappingURL=${location}`
}

export const remapper = ({
  inputAst,
  inputSource,
  inputSourceMap,
  remapMethod,
  sourceMapLocationForSource,
  sourceMapName,
  assetMap,
}) => {
  const hasSourceMap = typeof inputSourceMap === "object" && inputSourceMap !== null

  if (hasSourceMap && remapMethod === "inline") {
    const mapAsBase64 = new Buffer(JSON.stringify(inputSourceMap)).toString("base64")
    const outputSource = writeSourceMapLocation({
      source: inputSource,
      location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
    })

    const assetMapWithoutMapFile = objectFilter(assetMap, (key) => key !== sourceMapName)

    return {
      outputSource,
      outputSourceMap: inputSourceMap,
      outputAst: inputAst,
      assetMap: assetMapWithoutMapFile,
    }
  }

  if (hasSourceMap && remapMethod === "comment") {
    const outputSource = writeSourceMapLocation({
      source: inputSource,
      location: sourceMapLocationForSource,
    })

    return {
      outputSource,
      outputSourceMap: inputSourceMap,
      outputAst: inputAst,
      assetMap,
    }
  }

  return {
    outputSource: inputSource,
    outputSourceMap: inputSourceMap,
    outputAst: inputAst,
    assetMap,
  }
}
