import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

await bundleNode({
  projectFolder: testFolder,
  into: "dist/node",
  entryPointMap: {
    main: "native-import.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
  compileGroupCount: 1,
  verbose: false,
})

const { namespace: actual } = await importNodeBundle({
  bundleFolder: `${testFolder}/dist/node`,
  file: `main.js`,
})
const expected = "function"
assert({ actual, expected })
