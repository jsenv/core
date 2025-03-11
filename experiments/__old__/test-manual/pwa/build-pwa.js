import { build } from "@jsenv/core"
// import { resolveUrl } from "@jsenv/filesystem"

const pwaDirectoryRelativeUrl = "./test-manual/pwa/app/"
const buildDirectoryRelativeUrl = "./test-manual/pwa/app/dist/"

build({
  rootDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl,
  babelPluginMap: {},
  entryPoints: {
    [`${pwaDirectoryRelativeUrl}main.html`]: "main.html",
  },
  serviceWorkers: [`${pwaDirectoryRelativeUrl}sw.js`],
  buildDirectoryClean: true,
  minification: false,
})
