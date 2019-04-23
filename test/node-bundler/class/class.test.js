import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const babelPluginTransformClasses = import.meta.require("@babel/plugin-transform-classes")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))

await bundleNode({
  projectFolder: testFolder,
  into: "dist/node",
  entryPointMap: {
    main: "main.js",
  },
  babelConfigMap: {
    "transform-classes": [babelPluginTransformClasses],
  },
  compileGroupCount: 1,
  verbose: false,
})

const { namespace: actual } = await importNodeBundle({
  bundleFolder: `${testFolder}/dist/node`,
  file: `main.js`,
})
const expected = 42
assert({ actual, expected })
