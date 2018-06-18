import path from "path"

const writeSourceMapLocation = ({ code, location }) => {
  return `${code}
//# sourceMappingURL=${location}`
}

const writeSourceMapBase64 = (code, map) => {
  const mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64")
  return writeSourceMapLocation({
    code,
    location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
  })
}

const writeSourceMapComment = (
  code,
  name, // TODO: use this argument instead of appending .map on clientLocation & serverLocation
  { rootLocation, compiledFolderRelativeLocation, inputRelativeLocation, outputRelativeLocation },
) => {
  // client thinks we are at compiled/folder/file.js
  const clientLocation = path.resolve(
    rootLocation,
    `${compiledFolderRelativeLocation}/${inputRelativeLocation}.map`,
  )
  // but the file is at build/folder/file.js/sjklqdjkljkljlk/file.js
  const serverLocation = `${path.resolve(rootLocation, outputRelativeLocation)}.map`
  // so client can found it at ../../build/folder/file.js/sjklqdjkljkljlk/file.js.map
  const relativeLocation = path.relative(clientLocation, serverLocation)

  return writeSourceMapLocation({ code, location: relativeLocation })
}

export const sourceMapper = ({ code, map, ...rest }, { sourceMapLocation }, context) => {
  if (typeof map === "object") {
    // delete map.sourcesContent
    // we could remove sources content, they can be fetched from server
    // removing them will decrease size of sourceMap BUT force
    // the client to fetch the source resulting in an additional http request

    // we could delete map.sourceRoot to ensure clientLocation is absolute
    // but it's not set anyway because not passed to babel during compilation

    if (sourceMapLocation === "inline") {
      return {
        code: writeSourceMapBase64(code, map, context),
        map,
        ...rest,
      }
    }
    if (sourceMapLocation === "comment") {
      // folder/file.js -> file.js.map
      const name = `${path.basename(context.inputRelativeLocation)}.map`

      return {
        code: writeSourceMapComment(code, name, context),
        map,
        mapName: name,
        ...rest,
      }
    }
  }

  return { code, map, ...rest }
}
