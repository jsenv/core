import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/top-level-await`

bundleNode({
  projectFolder: testFolder,
  into: "dist/node",
  entryPointMap: {
    main: "top-level-await.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
  verbose: true,
})
