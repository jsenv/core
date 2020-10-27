import { resolveUrl, fileSystemPathToUrl } from "@jsenv/util"
import { require } from "./require.js"
import { jsenvCoreDirectoryUrl } from "./jsenvCoreDirectoryUrl.js"

export const jsenvNodeSystemUrl = resolveUrl(
  "./src/internal/node-launcher/node-js-file.js",
  jsenvCoreDirectoryUrl,
)
export const jsenvNodeSystemBundleUrl = resolveUrl(
  "./dist/jsenv-node-system.cjs",
  jsenvCoreDirectoryUrl,
)

export const jsenvBrowserSystemUrl = resolveUrl(
  "./src/internal/browser-launcher/jsenv-browser-system.js",
  jsenvCoreDirectoryUrl,
)
export const jsenvBrowserSystemBundleUrl = resolveUrl(
  "./dist/jsenv-browser-system.js",
  jsenvCoreDirectoryUrl,
)

export const exploringRedirectorHtmlFileUrl = resolveUrl(
  "./src/internal/exploring/exploring.redirector.html",
  jsenvCoreDirectoryUrl,
)

export const exploringRedirectorJsFileUrl = resolveUrl(
  "./src/internal/exploring/exploring.redirector.js",
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

export const jsenvToolbarJsFileUrl = resolveUrl(
  "./src/internal/toolbar/toolbar.js",
  jsenvCoreDirectoryUrl,
)

export const jsenvToolbarHtmlFileUrl = resolveUrl(
  "./src/internal/toolbar/toolbar.html",
  jsenvCoreDirectoryUrl,
)

export const jsenvToolbarMainJsFileUrl = resolveUrl(
  "./src/internal/toolbar/toolbar.main.js",
  jsenvCoreDirectoryUrl,
)
