import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/two-entry`

;(async () => {
  await bundleNode({
    projectFolder: testFolder,
    into: "dist/node",
    entryPointMap: {
      a: "a.js",
      b: "b.js",
    },
    babelConfigMap: {
      "transform-block-scoping": [blockScoping],
    },
    verbose: true,
  })

  {
    const { namespace: actual } = await importNodeBundle({
      bundleFolder: `${testFolder}/dist/node`,
      file: `main.js`,
    })
    const expected = "a-shared"
    assert({ actual, expected })
  }
  {
    const { namespace: actual } = await importNodeBundle({
      bundleFolder: `${testFolder}/dist/node`,
      file: `main.js`,
    })
    const expected = "b-shared"
    assert({ actual, expected })
  }
})()
