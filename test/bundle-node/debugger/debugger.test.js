import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.reuire("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/debugger`

bundleNode({
  projectFolder: testFolder,
  into: "dist/node",
  entryPointObject: {
    main: "debugger.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
})
