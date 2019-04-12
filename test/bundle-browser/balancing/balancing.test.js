import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

await bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  babelConfigMap: {
    "transform-async-to-promises": [transformAsyncToPromises],
  },
  entryPointMap: {
    main: "balancing.js",
  },
  compileGroupCount: 2,
  minify: false,
})

const { namespace: actual } = await importBrowserBundle({
  bundleFolder: `${testFolder}/dist/browser`,
  file: "main.js",
})
const expected = { default: 42 }
assert({ actual, expected })
