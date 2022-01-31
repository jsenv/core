import { resolveUrl, fileSystemPathToUrl } from "@jsenv/filesystem"

import { require } from "./internal/require.js"

export const jsenvCoreDirectoryUrl = String(new URL("../", import.meta.url))

export const jsenvDistDirectoryUrl = String(
  new URL("./dist/", jsenvCoreDirectoryUrl),
)

export const jsenvHelpersDirectoryInfo = {
  url: resolveUrl("./helpers/", jsenvCoreDirectoryUrl),
}

export const sourcemapMainFileInfo = {
  url: fileSystemPathToUrl(require.resolve("source-map/dist/source-map.js")),
}

export const sourcemapMappingFileInfo = {
  url: fileSystemPathToUrl(require.resolve("source-map/lib/mappings.wasm")),
}

export const jsenvSystemJsFileInfo = {
  url: resolveUrl("./src/internal/runtime_client/s.js", jsenvCoreDirectoryUrl),
  jsenvRelativeUrl: "./src/internal/runtime_client/s.js",
}

export const jsenvResolveImportUrlHelper = {
  url: resolveUrl(
    "./src/internal/building/url_versioning/resolve_import_url_helper.js",
    jsenvCoreDirectoryUrl,
  ),
  jsenvRelativeUrl:
    "./src/internal/building/url_versioning/resolve_import_url_helper.js",
}
