import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const babelPluginTransformClasses = import.meta.require("@babel/plugin-transform-classes")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/class`

;(async () => {
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
})()
