import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/without-balancing`

;(async () => {
  await bundleNode({
    projectFolder: testFolder,
    into: "dist/node",
    entryPointMap: {
      main: "without-balancing.js",
    },
    babelConfigMap: {
      "transform-block-scoping": [blockScoping],
    },
    compileGroupCount: 1,
    verbose: true,
  })

  const { namespace: actual } = await importNodeBundle({
    bundleFolder: `${testFolder}/dist/node`,
    file: `main.js`,
  })
  const expected = 42
  assert({ actual, expected })
})()
