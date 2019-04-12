import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { bundleBrowser } from "../../../index.js"
import { importBrowserBundle } from "../import-browser-bundle.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

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
  verbose: false,
})
const { namespace: actual, serverOrigin } = await importBrowserBundle({
  bundleFolder: `${testFolder}/dist/browser`,
  file: "main.js",
})
const expected = { default: `${serverOrigin}/main.js` }
assert({ actual, expected })
