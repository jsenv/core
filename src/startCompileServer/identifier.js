import path from "path"

const writeSourceLocation = ({ code, location }) => {
  return `${code}
//# sourceURL=${location}`
}

const writeSourceURL = (
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

export const identifier = ({ code, ...rest }, options, context) => {
  return {
    code: writeSourceURL(code, context),
    ...rest,
  }
}
