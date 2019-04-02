import { bundleNode } from "../../bundleNode.js"

const { projectFolder } = import.meta.require("../../../../../jsenv.config.js")
const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")

bundleNode({
  projectFolder,
  into: "dist/node",
  entryPointMap: {
    main: "src/bundle/node/test/native-import/native-import.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
  compileGroupCount: 1,
  verbose: true,
})
