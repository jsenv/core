import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.reuire("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/two-entry`

bundleNode({
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
