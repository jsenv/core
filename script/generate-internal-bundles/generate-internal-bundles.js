// import { resolveUrl } from "@jsenv/util"
import { generateBundle } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const bundlesToGenerate = [
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    bundleDirectoryRelativeUrl: "dist",
    format: "commonjs",
    entryPointMap: {
      "./src/internal/node-launcher/node-js-file.js": "./jsenv-node-system.cjs",
    },
  },
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    bundleDirectoryRelativeUrl: "dist",
    format: "global",
    entryPointMap: {
      "./src/internal/browser-launcher/jsenv-browser-system.js": "./jsenv-browser-system.js",
    },
  },
  // il faut aussi faire le exploring redirector et jsenv toolbar
]

await bundlesToGenerate.reduce(async (previous, bundleToGenerate) => {
  await previous
  await generateBundle(bundleToGenerate)
}, Promise.resolve())
