import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-browser/import-meta-url`

;(async () => {
  await bundleBrowser({
    projectFolder: testFolder,
    into: "dist/browser",
    entryPointMap: {
      main: "import-meta-url.js",
    },
    babelConfigMap: {
      "transform-block-scoping": [blockScoping],
    },
    compileGroupCount: 1,
    minify: false,
    verbose: true,
  })
  const { namespace: actual, serverOrigin } = await importBrowserBundle({
    bundleFolder: `${testFolder}/dist/browser`,
    file: "main.js",
  })
  const expected = { default: `${serverOrigin}/` }
  assert({ actual, expected })
})()
