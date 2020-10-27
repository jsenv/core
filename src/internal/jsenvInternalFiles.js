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

export const sourcemapMainFileUrl = fileSystemPathToUrl(
  require.resolve("source-map/dist/source-map.js"),
)

export const sourcemapMappingFileUrl = fileSystemPathToUrl(
  require.resolve("source-map/lib/mappings.wasm"),
)

// Exploring redirection
// (auto redirection to a compile group depending on browser capabilities)
export const jsenvExploringRedirectorHtmlUrl = resolveUrl(
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

// Exploring index and toolbar
export const jsenvExploringHtmlUrl = resolveUrl(
  "./src/internal/exploring/exploring.html",
  jsenvCoreDirectoryUrl,
)
export const jsenvToolbarHtmlUrl = resolveUrl(
  "./src/internal/toolbar/toolbar.html",
  jsenvCoreDirectoryUrl,
)
export const jsenvToolbarJsRelativeUrl = "./src/internal/toolbar/toolbar.main.js"
export const jsenvToolbarJsBundleRelativeUrl = "dist/jsenv-toolbar.js"
export const jsenvToolbarJsUrl = resolveUrl(jsenvToolbarJsRelativeUrl, jsenvCoreDirectoryUrl)
export const jsenvToolbarJsBundleUrl = resolveUrl(
  jsenvToolbarJsBundleRelativeUrl,
  jsenvCoreDirectoryUrl,
)
