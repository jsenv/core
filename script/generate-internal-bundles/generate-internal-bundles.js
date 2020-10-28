// import { resolveUrl } from "@jsenv/util"
import { generateBundle } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  jsenvNodeSystemRelativeUrl,
  jsenvBrowserSystemRelativeUrl,
  jsenvExploringRedirectorJsRelativeUrl,
  jsenvToolbarInjectorRelativeUrl,
  jsenvToolbarJsRelativeUrl,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"

const bundlesToGenerate = [
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    bundleDirectoryRelativeUrl: "dist",
    format: "commonjs",
    entryPointMap: {
      [jsenvNodeSystemRelativeUrl]: "./jsenv-node-system.cjs",
    },
    externalImportSpecifiers: [
      "@jsenv/server",
      "@jsenv/util",
      "@jsenv/uneval",
      "@jsenv/import-map",
    ],
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
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    bundleDirectoryRelativeUrl: "dist",
    format: "global",
    entryPointMap: {
      [jsenvToolbarInjectorRelativeUrl]: "./jsenv-toolbar-injector.js",
    },
  },
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    bundleDirectoryRelativeUrl: "dist",
    format: "global",
    entryPointMap: {
      [jsenvToolbarJsRelativeUrl]: "./jsenv-toolbar.js",
    },
  },
]

await bundlesToGenerate.reduce(async (previous, bundleToGenerate) => {
  await previous
  await generateBundle(bundleToGenerate)
}, Promise.resolve())
