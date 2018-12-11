export const getBrowserPlatformRemoteURL = ({ remoteRoot, compileInto }) => {
  return `${remoteRoot}/${compileInto}/browserPlatform.js`
}

export const getBrowserPlatformLocalURL = ({ localRoot, compileInto }) => {
  return `${localRoot}/${compileInto}/browserPlatform.js`
}

// export const compilePlatform = (localURL) => {
//   const from = require.resolve("@dmail/module-loader/dist/browser-platform.js")
//   const to = localURL
//   return copyFile(from, to)
// }

export const getCompileMapLocalURL = ({ localRoot, compileInto }) => {
  return `${localRoot}/${compileInto}/compileMap.json`
}

export const getCompileMapRemoteURL = ({ remoteRoot, compileInto }) => {
  return `${remoteRoot}/${compileInto}/compileMap.json`
}
