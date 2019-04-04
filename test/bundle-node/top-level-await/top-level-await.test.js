import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleNode } from "../../../index.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/top-level-await`

;(async () => {
  await bundleNode({
    projectFolder: testFolder,
    into: "dist/node",
    entryPointMap: {
      main: "top-level-await.js",
    },
    babelConfigMap: {
      "transform-async-to-promises": [transformAsyncToPromises],
    },
    verbose: true,
  })

  const actual = import.meta.require(`${testFolder}/dist/node/main.js`)
  const expected = 42
  assert({ actual, expected })
})()
