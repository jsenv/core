import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

await bundleNode({
  projectFolder: testFolder,
  into: "dist/node",
  entryPointMap: {
    main: "top-level-await.js",
  },
  babelConfigMap: {
    "transform-async-to-promises": [transformAsyncToPromises],
  },
  verbose: false,
})

const { namespace: actual } = await importNodeBundle({
  bundleFolder: `${testFolder}/dist/node`,
  file: `main.js`,
})
const expected = 42
assert({ actual, expected })
