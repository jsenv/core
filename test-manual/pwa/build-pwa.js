import { buildProject } from "@jsenv/core"
// import { resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const projectDirectoryUrl = jsenvCoreDirectoryUrl
const pwaDirectoryRelativeUrl = "./test-manual/pwa/app/"
const buildDirectoryRelativeUrl = "./test-manual/pwa/app/dist/"

// https://web.dev/manifest-updates/

buildProject({
  projectDirectoryUrl,
  buildDirectoryRelativeUrl,
  entryPointMap: {
    [`${pwaDirectoryRelativeUrl}main.html`]: "main.html",
  },
  serviceWorkers: {
    [`${pwaDirectoryRelativeUrl}sw.js`]: "sw.js",
  },
  buildDirectoryClean: true,
})
