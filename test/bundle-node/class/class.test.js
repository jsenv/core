import { bundleNode } from "../../../index.js"

const babelPluginTransformClasses = import.meta.require("@babel/plugin-transform-classes")
const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/class`

bundleNode({
  projectFolder: testFolder,
  into: "dist/node",
  entryPointMap: {
    main: "main.js",
  },
  babelConfigMap: {
    "transform-classes": [babelPluginTransformClasses],
  },
  compileGroupCount: 2,
  verbose: true,
})
