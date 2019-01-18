export const getBrowserPlatformRemoteURL = ({ remoteRoot }) =>
  `${remoteRoot}/node_modules/dev-server/dist/browserPlatform.js`

export const getBrowserSystemImporterRemoteURL = ({ remoteRoot }) =>
  `${remoteRoot}/node_modules/dev-server/dist/browserSystemImporter.js`

export const getCompileMapRemoteURL = ({ remoteRoot, compileInto }) =>
  `${remoteRoot}/${compileInto}/compileMap.json`
