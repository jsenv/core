import { resolveUrl, fileSystemPathToUrl } from "@jsenv/util"
import { require } from "./require.js"
import { jsenvCoreDirectoryUrl } from "./jsenvCoreDirectoryUrl.js"

export const jsenvNodeSystemRelativeUrl = "./src/internal/node-launcher/node-js-file.js"
export const jsenvNodeSystemBundleRelativeUrl = "./dist/jsenv-node-system.cjs"
export const jsenvNodeSystemUrl = resolveUrl(jsenvNodeSystemRelativeUrl, jsenvCoreDirectoryUrl)
export const jsenvNodeSystemBundleUrl = resolveUrl(
  jsenvNodeSystemBundleRelativeUrl,
  jsenvCoreDirectoryUrl,
)

export const jsenvBrowserSystemRelativeUrl =
  "./src/internal/browser-launcher/jsenv-browser-system.js"
export const jsenvBrowserSystemBundleRelativeUrl = "./dist/jsenv-browser-system.js"
export const jsenvBrowserSystemUrl = resolveUrl(
  jsenvBrowserSystemRelativeUrl,
  jsenvCoreDirectoryUrl,
)
export const jsenvBrowserSystemBundleUrl = resolveUrl(
  jsenvBrowserSystemBundleRelativeUrl,
  jsenvCoreDirectoryUrl,
)

export const exploringRedirectorHtmlFileUrl = resolveUrl(
  "./src/internal/exploring/exploring.redirector.html",
  jsenvCoreDirectoryUrl,
)

export const jsenvExploringRedirectorJsRelativeUrl =
  "./src/internal/exploring/exploring.redirector.js"
export const jsenvExploringRedirectorJsBundleRelativeUrl = "./dist/jsenv-exploring-redirector.js"
export const jsenvExploringRedirectorJsUrl = resolveUrl(
  jsenvExploringRedirectorJsRelativeUrl,
  jsenvCoreDirectoryUrl,
)
export const jsenvExploringRedirectorJsBundleUrl = resolveUrl(
  jsenvExploringRedirectorJsBundleRelativeUrl,
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
