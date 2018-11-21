export const getLoaderLocal = ({ localRoot }) => {
  return `${localRoot}/dist/browser-loader.js`
}

export const getCompileMapLocal = ({ localRoot, compileInto }) => {
  return `${localRoot}/${compileInto}/compileMap.json`
}
