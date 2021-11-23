// import { resolveUrl } from "@jsenv/filesystem"
import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { redirectorJsFileInfo } from "@jsenv/core/src/internal/dev_server/redirector/redirector_file_info.js"
import { exploringIndexJsFileInfo } from "@jsenv/core/src/internal/dev_server/exploring/exploring_file_info.js"
import {
  jsenvBrowserSystemFileInfo,
  jsenvCompileProxyFileInfo,
  jsenvToolbarInjectorFileInfo,
  jsenvToolbarJsFileInfo,
} from "@jsenv/core/src/internal/jsenvInternalFiles.js"
import { eventSourceClientFileInfo } from "@jsenv/core/src/internal/dev_server/event_source_client/event_source_client_file_info.js"

const commonParams = {
  projectDirectoryUrl: jsenvCoreDirectoryUrl,
  importMapFileRelativeUrl: "./node_resolution.importmap",
  buildDirectoryRelativeUrl: "dist",
}

const buildsToGenerate = [
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvBrowserSystemFileInfo.jsenvRelativeUrl]:
        jsenvBrowserSystemFileInfo.jsenvBuildRelativeUrl,
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvCompileProxyFileInfo.jsenvRelativeUrl]:
        jsenvCompileProxyFileInfo.jsenvBuildRelativeUrl,
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [redirectorJsFileInfo.relativeUrl]: redirectorJsFileInfo.buildRelativeUrl,
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [eventSourceClientFileInfo.relativeUrl]:
        eventSourceClientFileInfo.buildRelativeUrl,
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [exploringIndexJsFileInfo.relativeUrl]:
        exploringIndexJsFileInfo.buildRelativeUrl,
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvToolbarInjectorFileInfo.jsenvRelativeUrl]:
        jsenvToolbarInjectorFileInfo.jsenvBuildRelativeUrl,
    },
  },
  {
    ...commonParams,
    format: "global",
    entryPointMap: {
      [jsenvToolbarJsFileInfo.jsenvRelativeUrl]:
        jsenvToolbarJsFileInfo.jsenvBuildRelativeUrl,
    },
  },
]

await buildsToGenerate.reduce(async (previous, buildToGenerate) => {
  await previous
  await buildProject(buildToGenerate)
}, Promise.resolve())
