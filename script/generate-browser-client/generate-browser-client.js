const { bundleBrowser } = require("@jsenv/core")
const { importMap, projectFolder, babelConfigMap } = require("../../jsenv.config.js")

bundleBrowser({
  importMap,
  projectFolder,
  into: "dist/browser-client",
  babelConfigMap,
  entryPointMap: {
    platform: "src/platform/browser/browserPlatform.js",
  },
  verbose: true,
  minify: false,
})
