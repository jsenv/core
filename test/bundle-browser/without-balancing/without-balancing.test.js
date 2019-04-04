import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-browser/without-balancing`

;(async () => {
  await bundleBrowser({
    projectFolder: testFolder,
    into: "dist/browser",
    babelConfigMap,
    entryPointMap: {
      main: "without-balancing.js",
    },
    verbose: true,
    minify: false,
  })
  const { namespace: actual } = await importBrowserBundle({
    bundleFolder: `${testFolder}/dist/browser`,
    file: "main.js",
  })
  const expected = { default: 42 }
  assert({ actual, expected })
})()
