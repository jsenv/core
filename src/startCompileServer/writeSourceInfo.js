import path from "path"

const writeSourceLocation = ({ code, location }) => {
  return `${code}
//# sourceURL=${location}`
}

export const writeSourceURL = (
  code,
  { rootLocation, compiledFolderRelativeLocation, inputRelativeLocation, outputRelativeLocation },
) => {
  // client thinks we are at compiled/folder/file.js
  const clientLocation = path.resolve(
    rootLocation,
    `${compiledFolderRelativeLocation}/${inputRelativeLocation}`,
  )
  // but the file is at build/folder/file.js/sjklqdjkljkljlk/file.js
  const serverLocation = path.resolve(rootLocation, outputRelativeLocation)
  // so client can found it at ../../build/folder/file.js/sjklqdjkljkljlk/file.js
  const relativeLocation = path.relative(clientLocation, serverLocation)

  return writeSourceLocation({ code, location: relativeLocation })
}

const writeSourceMapLocation = ({ code, location }) => {
  return `${code}
//# sourceMappingURL=${location}`
}

export const writeSourceMapBase64 = (code, map) => {
  const mapAsBase64 = new Buffer(JSON.stringify(map)).toString("base64")
  return writeSourceMapLocation({
    code,
    location: `data:application/json;charset=utf-8;base64,${mapAsBase64}`,
  })
}

export const writeSourceMapComment = (
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
