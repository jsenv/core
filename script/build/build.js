import { writeFile, ensureEmptyDirectory } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { redirectorJsFileInfo } from "@jsenv/core/src/internal/dev_server/redirector/redirector_file_info.js"
import { browserSystemFileInfo } from "@jsenv/core/src/internal/browser-launcher/browser_system/browser_system_file_info.js"
import { compileProxyJsFileInfo } from "@jsenv/core/src/internal/browser-launcher/compile_proxy/compile_proxy_file_info.js"
import { exploringIndexJsFileInfo } from "@jsenv/core/src/internal/dev_server/exploring/exploring_file_info.js"
import {
  toolbarInjectorFileInfo,
  toolbarJsFileInfo,
} from "@jsenv/core/src/internal/dev_server/toolbar/toolbar_file_info.js"

import { eventSourceClientFileInfo } from "@jsenv/core/src/internal/dev_server/event_source_client/event_source_client_file_info.js"

let internalBuildsManifest = {}
const buildInternalFile = async (params) => {
  const { buildManifest } = await buildProject({
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    importMapFileRelativeUrl: "./node_resolution.importmap",
    buildDirectoryRelativeUrl: "dist",
    urlVersionningForEntryPoints: true,
    format: "global",
    ...params,
  })
  Object.assign(internalBuildsManifest, buildManifest)
}

await ensureEmptyDirectory(new URL("./dist", jsenvCoreDirectoryUrl))

await buildInternalFile({
  entryPointMap: {
    [browserSystemFileInfo.sourceRelativeUrl]:
      browserSystemFileInfo.buildRelativeUrl,
  },
})

await buildInternalFile({
  entryPointMap: {
    [compileProxyJsFileInfo.sourceRelativeUrl]:
      compileProxyJsFileInfo.buildRelativeUrl,
  },
})

await buildInternalFile({
  entryPointMap: {
    [redirectorJsFileInfo.sourceRelativeUrl]:
      redirectorJsFileInfo.buildRelativeUrl,
  },
})
await buildInternalFile({
  entryPointMap: {
    [eventSourceClientFileInfo.sourceRelativeUrl]:
      eventSourceClientFileInfo.buildRelativeUrl,
  },
})
await buildInternalFile({
  entryPointMap: {
    [toolbarInjectorFileInfo.sourceRelativeUrl]:
      toolbarInjectorFileInfo.buildRelativeUrl,
  },
})
await buildInternalFile({
  entryPointMap: {
    [toolbarJsFileInfo.sourceRelativeUrl]: toolbarJsFileInfo.buildRelativeUrl,
  },
})

await buildInternalFile({
  entryPointMap: {
    [exploringIndexJsFileInfo.sourceRelativeUrl]:
      exploringIndexJsFileInfo.buildRelativeUrl,
  },
})

await writeFile(
  new URL("./dist/manifest.json", jsenvCoreDirectoryUrl),
  JSON.stringify(internalBuildsManifest, null, "  "),
)
