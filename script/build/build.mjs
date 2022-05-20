// check jsenv_file_selector.js too

import { build } from "@jsenv/core"

const jsenvRootDirectoryUrl = new URL("../../", import.meta.url)
const jsenvDistDirectoryUrl = new URL("./dist/", jsenvRootDirectoryUrl)

await build({
  rootDirectoryUrl: jsenvRootDirectoryUrl,
  buildDirectoryUrl: new URL("./event_source_client/", jsenvDistDirectoryUrl),
  entryPoints: {
    "./src/plugins/autoreload/dev_sse/client/event_source_client.js":
      "event_source_client.js",
  },
  sourcemaps: "file",
  minification: false,
  versioning: false,
  assetManifest: false,
})

await build({
  rootDirectoryUrl: jsenvRootDirectoryUrl,
  buildDirectoryUrl: new URL("./html_supervisor_setup/", jsenvDistDirectoryUrl),
  entryPoints: {
    "./src/plugins/html_supervisor/client/html_supervisor_setup.js":
      "html_supervisor_setup.js",
  },
  sourcemaps: "file",
  minification: false,
  versioning: false,
  assetManifest: false,
})

await build({
  rootDirectoryUrl: jsenvRootDirectoryUrl,
  buildDirectoryUrl: new URL(
    "./html_supervisor_installer/",
    jsenvDistDirectoryUrl,
  ),
  entryPoints: {
    "./src/plugins/html_supervisor/client/html_supervisor_installer.js":
      "html_supervisor_installer.js",
  },
  sourcemaps: "file",
  minification: false,
  versioning: false,
  assetManifest: false,
})
