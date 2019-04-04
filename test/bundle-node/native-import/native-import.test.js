import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/native-import`

bundleNode({
  projectFolder: testFolder,
  into: "dist/node",
  entryPointMap: {
    main: "native-import.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
  compileGroupCount: 1,
  verbose: true,
})
