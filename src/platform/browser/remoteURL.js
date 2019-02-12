export const getBrowserPlatformHref = ({ compiledRootHref }) =>
  `${compiledRootHref}/node_modules/@dmail/dev-server/dist/browserPlatform.js`

export const getBrowserSystemImporterHref = ({ compiledRootHref }) =>
  `${compiledRootHref}/node_modules/@dmail/dev-server/dist/browserSystemImporter.js`

export const getCompileMapHref = ({ compileInto, compiledRootHref }) =>
  `${compiledRootHref}/${compileInto}/compileMap.json`
