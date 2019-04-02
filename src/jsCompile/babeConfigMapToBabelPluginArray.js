import syntaxDynamicImport from "@babel/plugin-syntax-dynamic-import"
import syntaxImportMeta from "@babel/plugin-syntax-import-meta"

export const defaultBabelPluginArray = [syntaxDynamicImport, syntaxImportMeta]

export const babelConfigMapToBabelPluginArray = (babelConfigMap) => {
  const babelPluginArray = Object.keys(babelConfigMap).map((name) => babelConfigMap[name])
  return [...defaultBabelPluginArray, ...babelPluginArray]
}
