const { bundleBrowser } = require("@jsenv/core")
const { importMap, projectFolder, babelConfigMap } = require("../../jsenv.config.js")
const { fileCopy } = require("@dmail/helper")

const SYSTEMJS_RELATIVE_PATH = "src/systemjs/s.js"

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
  `${projectFolder}/${SYSTEMJS_RELATIVE_PATH}`,
  `${projectFolder}/dist/browser-client/system.js`,
)
