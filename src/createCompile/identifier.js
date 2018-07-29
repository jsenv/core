import path from "path"

const writeSourceLocation = ({ source, location }) => {
  return `${source}
//# sourceURL=${location}`
}

export const identifier = ({
  rootLocation,
  compiledFolderRelativeLocation,
  inputRelativeLocation,
  outputRelativeLocation,
  inputSource,
}) => {
  // client thinks we are at compiled/folder/file.js
  const clientLocation = path.resolve(
    rootLocation,
    `${compiledFolderRelativeLocation}/${inputRelativeLocation}`,
  )
  // but the file is at build/folder/file.js/sjklqdjkljkljlk/file.js
  const serverLocation = path.resolve(rootLocation, outputRelativeLocation)
  // so client can found it at ../../build/folder/file.js/sjklqdjkljkljlk/file.js
  const relativeLocation = path.relative(clientLocation, serverLocation)

  return {
    outputSource: writeSourceLocation({ source: inputSource, location: relativeLocation }),
  }
}
