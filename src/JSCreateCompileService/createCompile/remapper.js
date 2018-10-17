const writeSourceMapLocation = ({ source, location }) => {
  return `${source}
${"//#"} sourceMappingURL=${location}`
}

export const remapper = ({ inputSource, inputSourceMap, options, sourceMapLocationForSource }) => {
  if (typeof inputSourceMap !== "object" || inputSourceMap === null) {
    return null
  }

  if (options.remapMethod === "inline") {
    const mapAsBase64 = new Buffer(JSON.stringify(inputSourceMap)).toString("base64")
    const outputSource = writeSourceMapLocation({
      source: inputSource,
      location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
    })

    return {
      outputSource,
    }
  }

  if (options.remapMethod === "comment") {
    const outputSource = writeSourceMapLocation({
      source: inputSource,
      location: sourceMapLocationForSource,
    })

    return {
      outputSource,
    }
  }

  return null
}
