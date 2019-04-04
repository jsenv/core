import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/import-meta-require`

;(async () => {
  await bundleNode({
    projectFolder: testFolder,
    into: "dist/node",
    entryPointMap: {
      main: "import-meta-require.js",
    },
    babelConfigMap: {
      "transform-block-scoping": [blockScoping],
    },
    compileGroupCount: 1,
    minify: false,
    verbose: true,
  })

  const actual = import.meta.require(`${testFolder}/dist/node/main.js`)
  const expected = "function"
  assert({ actual, expected })
})()
