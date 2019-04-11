import { assert } from "/node_modules/@dmail/assert/index.js"
import { bundleNode } from "../../../index.js"
import { importNodeBundle } from "../import-node-bundle.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/dynamic-import-origin-relative`

;(async () => {
  await bundleNode({
    projectFolder: testFolder,
    into: "dist/node",
    entryPointMap: {
      main: "dynamic-import-origin-relative.js",
    },
    babelConfigMap: {},
    compileGroupCount: 1,
    verbose: false,
  })

  const { namespace } = await importNodeBundle({
    bundleFolder: `${testFolder}/dist/node`,
    file: "main.js",
  })
  const actual = await namespace
  const expected = { default: 42 }
  assert({ actual, expected })
})()
