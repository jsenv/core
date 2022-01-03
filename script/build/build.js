import { writeFile } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

let buildManifestCode = ""
let buildManifest
const buildInternalFile = async ({
  buildDirectoryRelativeUrl,
  entryPoints,
  ...params
}) => {
  const build = await buildProject({
    projectDirectoryUrl: jsenvCoreDirectoryUrl,
    buildDirectoryRelativeUrl,
    entryPoints,
    assetManifestFile: true,
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
  entryPoints: {
    "./src/internal/dev_server/redirector/redirector.html":
      "redirector_[hash].html",
  },
})
addExport(
  "REDIRECTOR_BUILD_URL",
  `redirector/${buildManifest["redirector.html"]}`,
)

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/browser_runtime/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPoints: {
    "./src/internal/browser_runtime/browser_runtime.js":
      "browser_runtime_[hash].js",
  },
})
addExport(
  "BROWSER_RUNTIME_BUILD_URL",
  `browser_runtime/${buildManifest["browser_runtime.js"]}`,
)

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/compile_proxy/",
  entryPoints: {
    "./src/internal/browser_feature_detection/compile_proxy.html":
      "compile_proxy_[hash].html",
  },
})
addExport(
  "COMPILE_PROXY_BUILD_URL",
  `compile_proxy/${buildManifest["compile_proxy.html"]}`,
)

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/event_source_client/",
  entryPoints: {
    "./src/internal/dev_server/event_source_client/event_source_client.js":
      "event_source_client_[hash].js",
  },
})
addExport(
  "EVENT_SOURCE_CLIENT_BUILD_URL",
  `event_source_client/${buildManifest["event_source_client.js"]}`,
)

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/toolbar/",
  entryPoints: {
    "./src/internal/dev_server/toolbar/toolbar.html": "toolbar_[hash].html",
  },
  cssConcatenation: true,
})
addExport("TOOLBAR_BUILD_URL", `toolbar/${buildManifest["toolbar.html"]}`)

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/toolbar_injector/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPoints: {
    "./src/internal/dev_server/toolbar/toolbar.injector.js":
      "toolbar_injector_[hash].js",
  },
  customCompilers: {
    "./src/internal/dev_server/toolbar/toolbar.injector.js": ({ code }) => {
      const compiledSource = code.replace(
        "__TOOLBAR_BUILD_RELATIVE_URL_",
        JSON.stringify(`dist/toolbar/${buildManifest["toolbar.html"]}`),
      )

      return {
        compiledSource,
        responseHeaders: {
          "cache-control": "no-store",
        },
      }
    },
  },
})
addExport(
  "TOOLBAR_INJECTOR_BUILD_URL",
  `toolbar_injector/${buildManifest["toolbar_injector.js"]}`,
)

await writeFile(
  new URL("./dist/build_manifest.js", jsenvCoreDirectoryUrl),
  buildManifestCode,
)
