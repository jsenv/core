import syntaxDynamicImport from "@babel/plugin-syntax-dynamic-import"
import syntaxImportMeta from "@babel/plugin-syntax-import-meta"

export const defaultBabelPluginArray = [syntaxDynamicImport, syntaxImportMeta]

export const babelPluginDescriptionToBabelPluginArray = (babelPluginDescription) => {
  const babelPluginArray = Object.keys(babelPluginDescription).map(
    (name) => babelPluginDescription[name],
  )
  return [...defaultBabelPluginArray, ...babelPluginArray]
}
