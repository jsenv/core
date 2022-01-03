import { buildProject } from "@jsenv/core"
// import { resolveUrl } from "@jsenv/filesystem"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const projectDirectoryUrl = jsenvCoreDirectoryUrl
const pwaDirectoryRelativeUrl = "./test-manual/pwa/app/"
const buildDirectoryRelativeUrl = "./test-manual/pwa/app/dist/"

buildProject({
  projectDirectoryUrl,
  buildDirectoryRelativeUrl,
  babelPluginMap: {},
  entryPoints: {
    [`${pwaDirectoryRelativeUrl}main.html`]: "main.html",
  },
  serviceWorkers: {
    [`${pwaDirectoryRelativeUrl}sw.js`]: "sw.js",
  },
  buildDirectoryClean: true,
  minify: false,
})
