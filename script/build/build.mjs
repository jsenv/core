import { build } from "@jsenv/core"

const jsenvRootDirectoryUrl = new URL("../../", import.meta.url)
const jsenvDistDirectoryUrl = new URL("./dist/", jsenvRootDirectoryUrl)

await build({
  rootDirectoryUrl: jsenvRootDirectoryUrl,
  buildDirectoryUrl: jsenvDistDirectoryUrl,
  entryPoints: {
    "./src/plugins/html_supervisor/client/html_supervisor_installer.js":
      "html_supervisor_installer.js",
    "./src/plugins/autoreload/dev_sse/client/event_source_client.js":
      "event_source_client.js",
    "./src/plugins/html_supervisor/client/html_supervisor_setup.js":
      "html_supervisor_setup.js",
    "./src/plugins/import_meta_hot/client/import_meta_hot.js":
      "import_meta_hot.js",
  },
  baseUrl: "./",
  sourcemaps: "file",
  minification: false,
  versioning: false,
  assetManifest: false,
})
