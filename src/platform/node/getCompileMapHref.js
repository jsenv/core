export const getCompileMapHref = ({ compileInto, compileServerOrigin }) => {
  return `${compileServerOrigin}/${compileInto}/compileMap.json`
}
