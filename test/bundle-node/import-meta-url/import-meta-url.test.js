import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/import-meta-url`

;(async () => {
  await bundleNode({
    projectFolder: testFolder,
    into: "dist/node",
    entryPointMap: {
      main: "import-meta-url.js",
    },
    babelConfigMap: {
      "transform-block-scoping": [blockScoping],
    },
    // if we put 2 here, import.meta.url will contain the compileId
    // like best/otherwise, this is normal
    compileGroupCount: 1,
    minify: false,
    verbose: true,
  })

  const actual = import.meta.require(`${testFolder}/dist/node/main.js`)
  const expected = `file://${testFolder}/dist/node/main.js`
  assert({ actual, expected })
})()
