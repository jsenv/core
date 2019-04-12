import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const { babelConfigMap } = import.meta.require("@jsenv/babel-config-map")
const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

await bundleBrowser({
  projectFolder: testFolder,
  into: "dist/browser",
  babelConfigMap,
  entryPointMap: {
    main: "without-balancing.js",
  },
  verbose: false,
  minify: false,
})
const { namespace: actual } = await importBrowserBundle({
  bundleFolder: `${testFolder}/dist/browser`,
  file: "main.js",
})
const expected = { default: 42 }
assert({ actual, expected })
