// import { resolveUrl } from "@jsenv/util"
import { generateBundle } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  jsenvNodeSystemRelativeUrl,
  jsenvBrowserSystemRelativeUrl,
  jsenvExploringRedirectorJsRelativeUrl,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"

const bundlesToGenerate = [
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    bundleDirectoryRelativeUrl: "dist",
    format: "commonjs",
    entryPointMap: {
      [jsenvNodeSystemRelativeUrl]: "./jsenv-node-system.cjs",
    },
  },
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    bundleDirectoryRelativeUrl: "dist",
    format: "global",
    entryPointMap: {
      [jsenvBrowserSystemRelativeUrl]: "./jsenv-browser-system.js",
    },
  },
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    bundleDirectoryRelativeUrl: "dist",
    format: "global",
    entryPointMap: {
      [jsenvExploringRedirectorJsRelativeUrl]: "./jsenv-exploring-redirector.js",
    },
  },
  // il faut aussi faire le exploring redirector et jsenv toolbar
]

await bundlesToGenerate.reduce(async (previous, bundleToGenerate) => {
  await previous
  await generateBundle(bundleToGenerate)
}, Promise.resolve())
