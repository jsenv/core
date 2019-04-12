import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { generateImportMapForProjectNodeModules, bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

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
  verbose: false,
})

const { namespace: actual } = await importBrowserBundle({
  bundleFolder: `${testFolder}/dist/browser`,
  file: "main.js",
})
const expected = { default: 42 }
assert({ actual, expected })
