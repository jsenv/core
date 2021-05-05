// import { resolveUrl } from "@jsenv/util"
import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  jsenvBrowserSystemRelativeUrl,
  jsenvExploringRedirectorJsRelativeUrl,
  jsenvExploringIndexJsRelativeUrl,
  jsenvToolbarInjectorRelativeUrl,
  jsenvToolbarJsRelativeUrl,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"

const commonParams = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  importMapFileRelativeUrl: "./import-map.importmap",
  buildDirectoryRelativeUrl: "dist",
}

const buildsToGenerate = [
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvBrowserSystemRelativeUrl]: "./jsenv-browser-system.js",
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvExploringRedirectorJsRelativeUrl]: "./jsenv-exploring-redirector.js",
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvExploringIndexJsRelativeUrl]: "./jsenv-exploring-index.js",
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvToolbarInjectorRelativeUrl]: "./jsenv-toolbar-injector.js",
    },
  },
  {
    ...commonParams,
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
