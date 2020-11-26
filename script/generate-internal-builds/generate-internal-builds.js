// import { resolveUrl } from "@jsenv/util"
import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  jsenvNodeSystemRelativeUrl,
  jsenvBrowserSystemRelativeUrl,
  jsenvExploringRedirectorJsRelativeUrl,
  jsenvToolbarInjectorRelativeUrl,
  jsenvToolbarJsRelativeUrl,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"

const buildsToGenerate = [
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    buildDirectoryRelativeUrl: "dist",
    format: "commonjs",
    entryPointMap: {
      [jsenvNodeSystemRelativeUrl]: "./jsenv-node-system.cjs",
    },
  },
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    buildDirectoryRelativeUrl: "dist",
    format: "global",
    entryPointMap: {
      [jsenvBrowserSystemRelativeUrl]: "./jsenv-browser-system.js",
    },
  },
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    buildDirectoryRelativeUrl: "dist",
    format: "global",
    entryPointMap: {
      [jsenvExploringRedirectorJsRelativeUrl]: "./jsenv-exploring-redirector.js",
    },
  },
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    buildDirectoryRelativeUrl: "dist",
    format: "global",
    entryPointMap: {
      [jsenvToolbarInjectorRelativeUrl]: "./jsenv-toolbar-injector.js",
    },
  },
  {
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    buildDirectoryRelativeUrl: "dist",
    format: "global",
    entryPointMap: {
      [jsenvToolbarJsRelativeUrl]: "./jsenv-toolbar.js",
    },
  },
]

await buildsToGenerate.reduce(async (previous, buildToGenerate) => {
  await previous
  await buildProject(buildToGenerate)
}, Promise.resolve())
