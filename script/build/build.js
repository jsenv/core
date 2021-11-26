import { writeFile, resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

let internalBuildsManifest = {}
const buildInternalFile = async ({ buildDirectoryRelativeUrl, ...params }) => {
  const { buildManifest } = await buildProject({
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    urlVersionningForEntryPoints: true,
    buildDirectoryRelativeUrl,
    ...params,
  })
  const buildDirectoryUrl = resolveUrl(
    buildDirectoryRelativeUrl,
    jsenvCoreDirectoryUrl,
  )
  Object.keys(buildManifest).forEach((key) => {
    const buildRelativeUrlWithoutHash = resolveUrl(key, buildDirectoryUrl)
    const buildRelativeUrl = resolveUrl(buildManifest[key], buildDirectoryUrl)
    internalBuildsManifest[
      urlToRelativeUrl(buildRelativeUrlWithoutHash, jsenvCoreDirectoryUrl)
    ] = urlToRelativeUrl(buildRelativeUrl, jsenvCoreDirectoryUrl)
  })
}

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/redirector/",
  entryPointMap: {
    "./src/internal/dev_server/redirector/redirector.html": "./redirector.html",
  },
})

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/browser_system/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPointMap: {
    "./src/internal/browser-launcher/browser_system/browser_system.js":
      "./browser_system.js",
  },
})

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/compile_proxy/",
  entryPointMap: {
    "./src/internal/browser-launcher/compile_proxy/compile_proxy.html":
      "./compile_proxy.html",
  },
})

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/event_source_client/",
  entryPointMap: {
    "./src/internal/dev_server/event_source_client/event_source_client.js":
      "./event_source_client.js",
  },
})

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/toolbar_injector/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPointMap: {
    "./src/internal/dev_server/toolbar/toolbar.injector.js":
      "./toolbar_injector.js",
  },
})
await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/toolbar/",
  entryPointMap: {
    "./src/internal/dev_server/toolbar/toolbar.html": "./toolbar.html",
  },
})

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/exploring/",
  entryPointMap: {
    "./src/internal/dev_server/exploring/exploring.html": "./exploring.html",
  },
})

await writeFile(
  new URL("./dist/manifest.json", jsenvCoreDirectoryUrl),
  JSON.stringify(internalBuildsManifest, null, "  "),
)
