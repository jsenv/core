import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-browser/origin-relative`

;(async () => {
  await bundleBrowser({
    projectFolder: testFolder,
    into: "dist/browser",
    entryPointMap: {
      main: "origin-relative.js",
    },
    babelConfigMap: {
      "transform-block-scoping": [blockScoping],
    },
    verbose: true,
  })

  const { namespace: actual } = await importBrowserBundle({
    bundleFolder: `${testFolder}/dist/browser`,
    file: "main.js",
  })
  const expected = { default: 42 }
  assert({ actual, expected })
})()
