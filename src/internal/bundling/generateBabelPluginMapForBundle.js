import { resolveFileUrl } from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { createImportMetaUrlNamedImportBabelPlugin } from "./createImportMetaUrlNamedImportBabelPlugin.js"

export const generateBabelPluginMapForBundle = ({ format }) => {
  const bundleBabelPluginMap = {}

  if (format === "commonjs" || format === "global") {
    const importMetaFacadeUrl = resolveFileUrl(
      `./src/internal/bundling/import-meta-${format}.js`,
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
