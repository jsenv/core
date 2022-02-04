import { writeFile } from "@jsenv/filesystem"

import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"

// versioning is great when publishing the package to NPM
// because jsenv can enable long term caching of jsenv dist files
// but while working on jsenv it's simpler to have this disabled
const versioning = false

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
    "./src/internal/redirector/redirector.html": versioning
      ? "redirector_[hash].html"
      : "redirector.html",
  },
})
addExport(
  "REDIRECTOR_BUILD_URL",
  `redirector/${buildManifest["redirector.html"]}`,
)

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/browser_client/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPoints: {
    "./src/internal/browser_client/browser_client.js": versioning
      ? "browser_client_[hash].js"
      : "browser_client.js",
  },
  preservedDynamicImports: {
    "./src/internal/browser_client/browser_client.js": true,
  },
})
addExport(
  "BROWSER_CLIENT_BUILD_URL",
  `browser_client/${buildManifest["browser_client.js"]}`,
)

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/compile_proxy/",
  entryPoints: {
    "./src/internal/features/browser_feature_detection/compile_proxy.html":
      versioning ? "compile_proxy_[hash].html" : "compile_proxy.html",
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
      versioning ? "event_source_client_[hash].js" : "event_source_client.js",
  },
  preservedDynamicImports: {
    "./src/internal/dev_server/event_source_client/event_source_client.js": true,
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
    "./src/internal/dev_server/toolbar/toolbar.html": versioning
      ? "toolbar_[hash].html"
      : "toolbar.htm",
  },
  cssConcatenation: true,
})
addExport("TOOLBAR_BUILD_URL", `toolbar/${buildManifest["toolbar.html"]}`)

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/toolbar_injector/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPoints: {
    "./src/internal/dev_server/toolbar/toolbar_injector.js": versioning
      ? "toolbar_injector_[hash].js"
      : "toolbar_injector.js",
  },
  customCompilers: {
    "./src/internal/dev_server/toolbar/toolbar_injector.js": ({ code }) => {
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
