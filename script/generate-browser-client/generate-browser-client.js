const { bundleBrowser } = require("@jsenv/core")
const { readImportMap, projectFolder, babelConfigMap } = require("../../jsenv.config.js")
const { fileCopy } = require("@dmail/helper")

const SYSTEMJS_RELATIVE_PATH = "src/systemjs/s.js"

bundleBrowser({
  importMap: readImportMap(),
  projectFolder,
  into: "dist/browser-client",
  babelConfigMap,
  entryPointMap: {
    browserClient: "src/platform/browser/browserPlatform.js",
  },
  verbose: false,
  minify: false,
}).then(
  () => console.log(`-> ${projectFolder}/dist/browser-client/browserClient.js`),
  (e) =>
    setTimeout(() => {
      throw e
    }),
)

fileCopy(
  `${projectFolder}/${SYSTEMJS_RELATIVE_PATH}`,
  `${projectFolder}/dist/browser-client/system.js`,
).then(
  () => console.log(`-> ${projectFolder}/dist/browser-client/system.js`),
  (e) =>
    setTimeout(() => {
      throw e
    }),
)
