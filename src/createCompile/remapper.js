import path from "path"
import { normalizeSeparation } from "../createCompileService/helpers.js"

const writeSourceMapLocation = ({ source, location }) => {
  return `${source}
//# sourceMappingURL=${location}`
}

export const remapper = ({
  rootLocation,
  filename,
  outputRelativeLocation,
  inputSource,
  inputSourceMap,
  options,
}) => {
  if (typeof inputSourceMap !== "object") {
    return
  }

  // delete inputSourceMap.sourcesContent
  // we could remove sources content, they can be fetched from server
  // removing them will decrease size of sourceMap BUT force
  // the client to fetch the source resulting in an additional http request

  // we could delete inputSourceMap.sourceRoot to ensure clientLocation is absolute
  // but it's not set anyway because not passed to babel during compilation

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

  if (options.remapMethod === "comment-absolute") {
    const outputSourceMapName = `${path.basename(filename)}.map`

    // TODO: use outputSourceMapName instead of appending .map on outputRelativeLocation
    const serverLocation = `${path.resolve(rootLocation, outputRelativeLocation)}.map`

    const outputSource = writeSourceMapLocation({ source: inputSource, location: serverLocation })

    const outputSourceMap = {
      ...inputSourceMap,
      file: normalizeSeparation(path.resolve(rootLocation, inputSourceMap.file)),
      sources: inputSourceMap.sources.map((source) => {
        return normalizeSeparation(path.resolve(rootLocation, source))
      }),
    }

    return {
      outputSource,
      outputSourceMap,
      outputSourceMapName,
    }
  }

  if (options.remapMethod === "comment-relative") {
    // folder/file.js -> file.js.map
    const outputSourceMapName = `${path.basename(filename)}.map`
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
