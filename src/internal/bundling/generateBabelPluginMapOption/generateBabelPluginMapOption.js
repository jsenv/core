import { resolveFileUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { createImportMetaUrlNamedImportBabelPlugin } from "./createImportMetaUrlNamedImportBabelPlugin.js"

export const generateBabelPluginMapOption = ({
  format,
  babelPluginMap,
  babelPluginRequiredNameArray,
}) => {
  return {
    ...generateBabelPluginMapSubset({
      babelPluginMap,
      babelPluginRequiredNameArray,
    }),
    ...generateBabelPluginMapForBundle({
      format,
    }),
  }
}

const generateBabelPluginMapSubset = ({ babelPluginMap, babelPluginRequiredNameArray }) => {
  const babelPluginMapSubset = {}

  Object.keys(babelPluginMap).forEach((babelPluginName) => {
    if (babelPluginRequiredNameArray.includes(babelPluginName)) {
      babelPluginMapSubset[babelPluginName] = babelPluginMap[babelPluginName]
    }
  })

  return babelPluginMapSubset
}

const generateBabelPluginMapForBundle = ({ format }) => {
  const bundleBabelPluginMap = {}

  if (format === "commonjs" || format === "global") {
    const importMetaFacadeUrl = resolveFileUrl(
      `./src/internal/bundle/generateBabelPluginMapOption/import-meta-${format}.js`,
      jsenvCoreDirectoryUrl,
    )

    bundleBabelPluginMap[
      "import-meta-url-named-import"
    ] = createImportMetaUrlNamedImportBabelPlugin({
      importMetaFacadeUrl,
    })
  }

  return bundleBabelPluginMap
}
