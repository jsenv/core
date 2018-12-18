export const getBrowserPlatformRemoteURL = ({ remoteRoot }) => {
  return `${remoteRoot}/node_modules/dev-server/dist/browserPlatform.js`
}

export const getBrowserSystemImporterRemoteURL = ({ remoteRoot }) => {
  return `${remoteRoot}/node_modules/dev-server/dist/browserSystemImporter.js`
}

export const getCompileMapRemoteURL = ({ remoteRoot, compileInto }) => {
  return `${remoteRoot}/${compileInto}/compileMap.json`
}
