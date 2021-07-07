// import { resolveUrl } from "@jsenv/util"
import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import {
  jsenvBrowserSystemFileInfo,
  jsenvExploringRedirectorJsFileInfo,
  jsenvExploringIndexJsFileInfo,
  jsenvToolbarInjectorFileInfo,
  jsenvToolbarJsFileInfo,
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
      [jsenvBrowserSystemFileInfo.jsenvRelativeUrl]: "./jsenv-browser-system.js",
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvExploringRedirectorJsFileInfo.jsenvRelativeUrl]: "./jsenv-exploring-redirector.js",
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvExploringIndexJsFileInfo.jsenvRelativeUrl]: "./jsenv-exploring-index.js",
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvToolbarInjectorFileInfo.jsenvRelativeUrl]: "./jsenv-toolbar-injector.js",
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvToolbarJsFileInfo.jsenvRelativeUrl]: "./jsenv-toolbar.js",
    },
  },
]

await buildsToGenerate.reduce(async (previous, buildToGenerate) => {
  await previous
  await buildProject(buildToGenerate)
}, Promise.resolve())
