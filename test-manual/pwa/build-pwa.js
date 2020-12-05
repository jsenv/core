import { buildProject } from "@jsenv/core"
// import { resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"

const projectDirectoryUrl = jsenvCoreDirectoryUrl
const pwaDirectoryRelativeUrl = "./test-manual/pwa/app/"
const buildDirectoryRelativeUrl = "./test-manual/pwa/app/dist/"

// il faut que jsenv fasse deux choses:
// mettre le web manifest
// dans les staticUrlsHash assets/mille-sabords.webmanifest
// et il faudrait surement une nouvelle catégorie
// config.urlsToReloadOnInstall
// pour se simplifier la vie et on y mettrais
// le html et le webmanifest par défaut aussi

buildProject({
  projectDirectoryUrl,
  buildDirectoryRelativeUrl,
  babelPluginMap: {},
  entryPointMap: {
    [`${pwaDirectoryRelativeUrl}main.html`]: "./main.html",
  },
  serviceWorkers: {
    [`${pwaDirectoryRelativeUrl}sw.js`]: "sw.js",
  },
  buildDirectoryClean: true,
  minify: false,
})
