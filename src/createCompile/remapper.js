import path from "path"
import { normalizeSeparation } from "../createCompileService/helpers.js"

const writeSourceMapLocation = ({ source, location }) => {
  return `${source}
//# sourceMappingURL=${location}`
}

export const remapper = ({
  rootLocation,
  compiledFolderRelativeLocation,
  inputRelativeLocation,
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
    return {
      outputSource: writeSourceMapLocation({
        source: inputSource,
        location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
      }),
    }
  }

  if (options.remapMethod === "comment-absolute") {
    const outputSourceMapName = `${path.basename(inputRelativeLocation)}.map`

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
    const outputSourceMapName = `${path.basename(inputRelativeLocation)}.map`

    // client thinks we are at compiled/folder/file.js
    const clientLocation = path.resolve(
      rootLocation,
      // TODO: use outputSourceMapName instead of appending .map on clientLocation
      `${compiledFolderRelativeLocation}/${inputRelativeLocation}.map`,
    )
    // but the file is at build/folder/file.js/sjklqdjkljkljlk/file.js
    // TODO: use outputSourceMapName instead of appending .map on outputRelativeLocation
    const serverLocation = `${path.resolve(rootLocation, outputRelativeLocation)}.map`
    // so client can found it at ../../build/folder/file.js/sjklqdjkljkljlk/file.js.map

    const relativeLocation = normalizeSeparation(path.relative(clientLocation, serverLocation))
    const outputSource = writeSourceMapLocation({ source: inputSource, location: relativeLocation })

    return {
      outputSource,
      outputSourceMapName,
    }
  }
}
