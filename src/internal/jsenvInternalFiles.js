import { resolveUrl, fileSystemPathToUrl } from "@jsenv/util"
import { require } from "./require.js"
import { jsenvCoreDirectoryUrl } from "./jsenvCoreDirectoryUrl.js"

export const nodeJsFileUrl = resolveUrl(
  "./src/internal/node-launcher/node-js-file.js",
  jsenvCoreDirectoryUrl,
)

export const browserJsFileUrl = resolveUrl(
  "./src/internal/browser-launcher/jsenv-browser-system.js",
  jsenvCoreDirectoryUrl,
)

export const jsenvHtmlFileUrl = resolveUrl(
  "./src/internal/jsenv-html-file.html",
  jsenvCoreDirectoryUrl,
)

export const exploringHtmlFileUrl = resolveUrl(
  "./src/internal/exploring/exploring.html",
  jsenvCoreDirectoryUrl,
)

export const sourcemapMainFileUrl = fileSystemPathToUrl(
  require.resolve("source-map/dist/source-map.js"),
)

export const sourcemapMappingFileUrl = fileSystemPathToUrl(
  require.resolve("source-map/lib/mappings.wasm"),
)
