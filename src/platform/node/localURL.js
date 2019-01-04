export const getCompileMapLocalURL = ({ localRoot, compileInto }) => {
  return `${localRoot}/${compileInto}/compileMap.json`
}
