import { createImportMetaUrlNamedImportBabelPlugin } from "./createImportMetaUrlNamedImportBabelPlugin.js"

export const createBabePluginMapForBundle = ({ format }) => {
  return {
    ...(format === "global" || format === "commonjs"
      ? {
          "import-meta-url-named-import": createImportMetaUrlNamedImportBabelPlugin({
            importMetaSpecifier: `@jsenv/core/src/internal/bundling/import-meta-${format}.js`,
          }),
        }
      : {}),
  }
}
