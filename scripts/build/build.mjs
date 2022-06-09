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

// "s.js" is used in the build files, it must be compatible as much as possible
// so we convert async/await, arrow function, ... to be compatible with
// old browsers
await build({
  rootDirectoryUrl: jsenvRootDirectoryUrl,
  buildDirectoryUrl: jsenvDistDirectoryUrl,
  entryPoints: {
    "./src/plugins/transpilation/as_js_classic/client/s.js":
      "s.js?as_js_classic",
  },
  buildDirectoryClean: false,
  runtimeCompat: {
    chrome: "0",
    firefox: "0",
  },
  baseUrl: "./",
  sourcemaps: "file",
  minification: false,
  versioning: false,
  assetManifest: false,
})
