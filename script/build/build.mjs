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
  buildDirectoryRelativeUrl: "./dist/html_supervisor_classic/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPoints: {
    "./src/internal/html_supervisor/classic/html_supervisor_classic.js":
      "html_supervisor_classic.js",
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
    "./src/internal/event_source_client/event_source_client.js":
      "event_source_client.js",
  },
  preservedDynamicImports: {
    "./src/internal/event_source_client/event_source_client.js": true,
  },
})

await buildInternalFile({
  format: "systemjs",
  buildDirectoryRelativeUrl: "./dist/toolbar/",
  entryPoints: {
    "./src/internal/toolbar/toolbar.html": "toolbar.html",
  },
  cssConcatenation: true,
})

await buildInternalFile({
  format: "global",
  buildDirectoryRelativeUrl: "./dist/toolbar_injector/",
  importMapFileRelativeUrl: "./node_resolution.importmap",
  entryPoints: {
    "./src/internal/toolbar/toolbar_injector.js": "toolbar_injector.js",
  },
  customCompilers: {
    "./src/internal/toolbar/toolbar_injector.js": ({ code }) => {
      const content = code.replace(
        "__TOOLBAR_BUILD_RELATIVE_URL_",
        JSON.stringify(`dist/toolbar/toolbar.html`),
      )
      return {
        content,
        responseHeaders: {
          "cache-control": "no-store",
        },
      }
    },
  },
})
