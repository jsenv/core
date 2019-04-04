import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/https`

bundleNode({
  projectFolder: testFolder,
  entryPointMap: {
    main: "https.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
})
