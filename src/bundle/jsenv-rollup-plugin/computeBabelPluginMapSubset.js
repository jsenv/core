import { createReplaceImportMetaBabelPlugin } from "./replace-import-meta-babel-plugin.js"
import { createReplaceBabelHelperByNamedImportBabelPlugin } from "./replace-babel-helper-by-named-import-babel-plugin.js"

export const computeBabelPluginMapSubset = ({
  babelPluginMap,
  featureNameArray,
  target,
  BABEL_HELPERS_RELATIVE_PATH,
}) => {
  const babelPluginMapSubset = {}
  // instead of replacing import by a raw object
  // I should replace it with a named import (or just an import)
  // so that it does not end being duplicated
  // not very important
  const replaceBabelHelperByNamedImportBabelPlugin = createReplaceBabelHelperByNamedImportBabelPlugin(
    {
      BABEL_HELPERS_PATH: BABEL_HELPERS_RELATIVE_PATH,
    },
  )
  babelPluginMapSubset["replace-babel-helper-by-named-import"] = [
    replaceBabelHelperByNamedImportBabelPlugin,
  ]
  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    if (featureNameArray.includes(babelPluginName)) {
      babelPluginMapSubset[babelPluginName] = babelPluginMap[babelPluginName]
    }
  })
  if (target === "node") {
    const replaceImportMetaBabelPlugin = createReplaceImportMetaBabelPlugin({
      importMetaSource: createNodeImportMetaSource(),
    })
    babelPluginMapSubset["replace-import-meta"] = [replaceImportMetaBabelPlugin]
  }
  return babelPluginMapSubset
}

const createNodeImportMetaSource = () => `{
  url: "file://" + (__filename.indexOf("\\\\") === -1 ? __filename : "/" + __filename.replace(/\\\\/g, "/")),
  require: require
}`
