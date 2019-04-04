const { bundleBrowser } = require("@jsenv/core")
const { importMap, projectFolder, babelPluginDescription } = require("../../jsenv.config.js")

bundleBrowser({
  importMap,
  projectFolder,
  into: "dist/browser-client",
  babelPluginDescription,
  entryPointsDescription: {
    platform: "src/platform/browser/browserPlatform.js",
  },
  globalName: "__platform__",
  verbose: true,
  minify: false,
})

bundleBrowser({
  importMap,
  projectFolder,
  into: "dist/browser-client",
  babelPluginDescription,
  entryPointsDescription: {
    importer: "src/platform/browser/browserImporter.js",
  },
  globalName: "__browserImporter__",
  globalNameIsPromise: true,
  verbose: true,
  minify: false,
})
