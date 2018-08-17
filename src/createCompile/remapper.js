import path from "path"

const writeSourceMapLocation = ({ source, location }) => {
  return `${source}
//# sourceMappingURL=${location}`
}

export const remapper = ({ inputRelativeLocation, inputSource, inputSourceMap, options }) => {
  if (typeof inputSourceMap !== "object" || inputSourceMap === null) {
    return
  }

  // delete inputSourceMap.sourcesContent
  // we could remove sources content, they can be fetched from server
  // removing them will decrease size of sourceMap BUT force
  // the client to fetch the source resulting in an additional http request

  // we could delete inputSourceMap.sourceRoot to ensure clientLocation is absolute
  // but it's not set anyway because not passed to babel during compilation

  // force a browser reload
  delete inputSourceMap.sourcesContent

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
    // folder/file.js -> file.js.map
    const outputSourceMapName = `${path.basename(inputRelativeLocation)}.map`
    const outputSourceMapLocation = `./${outputSourceMapName}`
    const outputSource = writeSourceMapLocation({
      source: inputSource,
      location: outputSourceMapLocation,
    })

    return {
      outputSource,
      outputSourceMapName,
    }
  }
}
