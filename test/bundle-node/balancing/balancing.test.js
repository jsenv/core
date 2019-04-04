import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/balancing`

;(async () => {
  await bundleNode({
    projectFolder: testFolder,
    into: "dist/node",
    entryPointMap: {
      main: "balancing.js",
    },
    babelConfigMap: {
      "transform-block-scoping": [blockScoping],
    },
    compileGroupCount: 2,
    verbose: false,
  })

  // eslint-disable-next-line import/no-dynamic-require
  const actual = import.meta.require(`${testFolder}/dist/node/main.js`)
  const expected = 42
  assert({ actual, expected })
})()
