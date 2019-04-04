import { assert } from "/node_modules/@dmail/assert/index.js"
import { generateImportMapForProjectNodeModules, bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-browser/scoped-node-module`

;(async () => {
  const importMap = await generateImportMapForProjectNodeModules({ projectFolder: testFolder })

  await bundleBrowser({
    projectFolder: testFolder,
    importMap,
    into: "dist/browser",
    entryPointMap: {
      main: "scoped-node-module.js",
    },
    babelConfigMap: {
      "transform-block-scoping": [blockScoping],
    },
    compileGroupCount: 1,
    verbose: true,
  })

  const { namespace: actual } = await importBrowserBundle({
    bundleFolder: `${testFolder}/dist/browser`,
    file: "main.js",
  })
  const expected = { default: 42 }
  assert({ actual, expected })
})()
