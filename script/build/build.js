import { writeFile } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

let buildManifestCode = ""
let buildManifest
const buildInternalFile = async ({
  buildDirectoryRelativeUrl,
  entryPointMap,
  ...params
}) => {
  const build = await buildProject({
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    urlVersionningForEntryPoints: true,
    buildDirectoryRelativeUrl,
    entryPointMap,
    ...params,
  })
  buildManifest = build.buildManifest
  return build
}
const addExport = (exportName, distRelativeUrl) => {
  buildManifestCode += `
export const ${exportName} = new URL(${JSON.stringify(
    distRelativeUrl,
  )}, import.meta.url).href
`
}

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/redirector/",
  entryPointMap: {
    "./src/internal/dev_server/redirector/redirector.html": "./redirector.html",
  },
})
addExport(
  "REDIRECTOR_BUILD_URL",
  `redirector/${buildManifest["redirector.html"]}`,
)

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/browser_system/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPointMap: {
    "./src/internal/browser-launcher/browser_system/browser_system.js":
      "./browser_system.js",
  },
})
addExport(
  "BROWSER_SYSTEM_BUILD_URL",
  `browser_system/${buildManifest["browser_system.js"]}`,
)

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/compile_proxy/",
  entryPointMap: {
    "./src/internal/browser-launcher/compile_proxy/compile_proxy.html":
      "./compile_proxy.html",
  },
})
addExport(
  "COMPILE_PROXY_BUILD_URL",
  `compile_proxy/${buildManifest["compile_proxy.html"]}`,
)

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/event_source_client/",
  entryPointMap: {
    "./src/internal/dev_server/event_source_client/event_source_client.js":
      "./event_source_client.js",
  },
})
addExport(
  "EVENT_SOURCE_CLIENT_BUILD_URL",
  `event_source_client/${buildManifest["event_source_client.js"]}`,
)

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/toolbar_injector/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPointMap: {
    "./src/internal/dev_server/toolbar/toolbar.injector.js":
      "./toolbar_injector.js",
  },
})
addExport(
  "TOOLBAR_INJECTOR_BUILD_URL",
  `toolbar_injector/${buildManifest["toolbar_injector.js"]}`,
)

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/toolbar/",
  entryPointMap: {
    "./src/internal/dev_server/toolbar/toolbar.html": "./toolbar.html",
  },
  cssConcatenation: true,
})
addExport("TOOLBAR_BUILD_URL", `toolbar/${buildManifest["toolbar.html"]}`)

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/exploring/",
  entryPointMap: {
    "./src/internal/dev_server/exploring/exploring.html": "./exploring.html",
  },
  cssConcatenation: true,
})
addExport("EXPLORING_BUILD_URL", `exploring/${buildManifest["exploring.html"]}`)

await writeFile(
  new URL("./dist/build_manifest.js", jsenvCoreDirectoryUrl),
  buildManifestCode,
)
