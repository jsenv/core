import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

await bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  entryPointMap: {
    main: "dynamic-import.js",
  },
  babelConfigMap: {},
  compileGroupCount: 1,
  verbose: false,
  minify: false,
})
const { namespace: actual } = await importBrowserBundle({
  bundleFolder: `${testFolder}/dist/browser`,
  file: "main.js",
})
const expected = { default: 42 }
assert({ actual, expected })
