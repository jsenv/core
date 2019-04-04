import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/json`

;(async () => {
  await bundleNode({
    projectFolder: testFolder,
    into: "dist/node",
    entryPointMap: {
      main: "json.js",
    },
    babelConfigMap: {
      "transform-block-scoping": [blockScoping],
    },
    compileGroupCount: 1,
    minify: false,
    verbose: true,
  })

  // eslint-disable-next-line import/no-dynamic-require
  const actual = import.meta.require(`${testFolder}/dist/node/main.js`)
  const expected = { foo: true }
  assert({ actual, expected })
})()
