import { ensureEmptyDirectory } from "@jsenv/filesystem"

import { build } from "@jsenv/core"

const jsenvRootDirectoryUrl = new URL("../../", import.meta.url)
const jsenvDistDirectoryUrl = new URL("./dist/", jsenvRootDirectoryUrl)

await ensureEmptyDirectory(jsenvDistDirectoryUrl)

await build({
  rootDirectoryUrl: jsenvRootDirectoryUrl,
  buildDirectoryUrl: jsenvDistDirectoryUrl,
  entryPoints: {
    "./src/plugins/autoreload/dev_sse/client/event_source_client.js":
      "event_source_client.js",
  },
  buildDirectoryClean: false,
  sourcemaps: "file",
  minification: false,
  versioning: false,
  assetManifest: false,
})

await build({
  rootDirectoryUrl: jsenvRootDirectoryUrl,
  buildDirectoryUrl: jsenvDistDirectoryUrl,
  entryPoints: {
    "./src/plugins/html_supervisor/client/html_supervisor_setup.js":
      "html_supervisor_setup.js",
  },
  buildDirectoryClean: false,
  sourcemaps: "file",
  minification: false,
  versioning: false,
  assetManifest: false,
})

await build({
  rootDirectoryUrl: jsenvRootDirectoryUrl,
  buildDirectoryUrl: jsenvDistDirectoryUrl,
  entryPoints: {
    "./src/plugins/html_supervisor/client/html_supervisor_installer.js":
      "html_supervisor_installer.js",
  },
  buildDirectoryClean: false,
  sourcemaps: "file",
  minification: false,
  versioning: false,
  assetManifest: false,
})
