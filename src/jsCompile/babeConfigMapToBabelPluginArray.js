const syntaxDynamicImport = import.meta.require("@babel/plugin-syntax-dynamic-import")
const syntaxImportMeta = import.meta.require("@babel/plugin-syntax-import-meta")

export const defaultBabelPluginArray = [syntaxDynamicImport, syntaxImportMeta]

export const babelConfigMapToBabelPluginArray = (babelConfigMap) => {
  const babelPluginArray = Object.keys(babelConfigMap).map((name) => babelConfigMap[name])
  return [...defaultBabelPluginArray, ...babelPluginArray]
}
