import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

await bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  entryPointMap: {
    main: "dynamic-import-origin-relative.js",
  },
  babelConfigMap: {},
  compileGroupCount: 1,
  verbose: false,
})

const { namespace: actual } = await importBrowserBundle({
  bundleFolder: `${testFolder}/dist/browser`,
  file: "main.js",
})
const expected = { default: 42 }
assert({ actual, expected })
