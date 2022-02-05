import { buildProject } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"

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

  return build
}

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/redirector/",
  entryPoints: {
    "./src/internal/redirector/redirector.html": "redirector.html",
  },
})

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/browser_client_systemjs/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPoints: {
    "./src/internal/browser_client/systemjs/browser_client_systemjs.js":
      "browser_client_systemjs.js",
  },
  preservedDynamicImports: {
    "./src/internal/browser_client/browser_client.js": true,
  },
})

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/compile_proxy/",
  entryPoints: {
    "./src/internal/features/browser_feature_detection/compile_proxy.html":
      "compile_proxy.html",
  },
})

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/event_source_client/",
  entryPoints: {
    "./src/internal/dev_server/event_source_client/event_source_client.js":
      "event_source_client.js",
  },
  preservedDynamicImports: {
    "./src/internal/dev_server/event_source_client/event_source_client.js": true,
  },
})

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/toolbar/",
  entryPoints: {
    "./src/internal/dev_server/toolbar/toolbar.html": "toolbar.html",
  },
  cssConcatenation: true,
})

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/toolbar_injector/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPoints: {
    "./src/internal/dev_server/toolbar/toolbar_injector.js":
      "toolbar_injector.js",
  },
  customCompilers: {
    "./src/internal/dev_server/toolbar/toolbar_injector.js": ({ code }) => {
      const compiledSource = code.replace(
        "__TOOLBAR_BUILD_RELATIVE_URL_",
        JSON.stringify(`dist/toolbar/toolbar.html`),
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
