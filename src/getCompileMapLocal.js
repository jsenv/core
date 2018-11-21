export const getCompileMapLocal = ({ localRoot, compileInto }) => {
  return `${localRoot}/${compileInto}/compileMap.json`
}
