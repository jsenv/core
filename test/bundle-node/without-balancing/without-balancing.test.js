import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.reuire("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/without-balancing`

bundleNode({
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
