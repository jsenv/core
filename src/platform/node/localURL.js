export const getCompileMapHref = ({ compileInto, sourceRootHref }) => {
  return `${sourceRootHref}/${compileInto}/compileMap.json`
}
