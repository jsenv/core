const { bundleBrowser } = require("@jsenv/core")
const { importMap, projectFolder, babelConfigMap } = require("../../jsenv.config.js")
const { fileCopy } = require("@dmail/helper")

bundleBrowser({
  importMap,
  projectFolder,
  into: "dist/browser-client",
  babelConfigMap,
  entryPointMap: {
    browserClient: "src/platform/browser/browserPlatform.js",
  },
  verbose: true,
  minify: false,
})

fileCopy(
  `${projectFolder}/node_modules/systemjs/dist/s.js`,
  `${projectFolder}/dist/browser-client/system.js`,
)
