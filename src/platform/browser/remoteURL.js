export const getBrowserPlatformHref = ({ compileServerOrigin }) =>
  `${compileServerOrigin}/node_modules/@dmail/dev-server/dist/browserPlatform.js`

export const getBrowserSystemImporterHref = ({ compileServerOrigin }) =>
  `${compileServerOrigin}/node_modules/@dmail/dev-server/dist/browserSystemImporter.js`

export const getCompileMapHref = ({ compileInto, compileServerOrigin }) =>
  `${compileServerOrigin}/${compileInto}/compileMap.json`
