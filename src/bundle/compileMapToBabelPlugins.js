import syntaxDynamicImport from "@babel/plugin-syntax-dynamic-import"
import syntaxImportMeta from "@babel/plugin-syntax-import-meta"

export const compileMapToBabelPlugins = (compileMap) => {
  const babelPlugins = Object.keys(compileMap).map((name) => compileMap[name])
  return [syntaxDynamicImport, syntaxImportMeta, ...babelPlugins]
}
