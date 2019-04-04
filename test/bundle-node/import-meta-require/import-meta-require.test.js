import { bundleNode } from "../../../index.js"

const blockScoping = import.meta.require("@babel/plugin-transform-block-scoping")
const { projectFolder } = import.meta.reuire("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/bundle-node/import-meta-require`

bundleNode({
  projectFolder: testFolder,
  into: "dist/node",
  entryPointMap: {
    main: "import-meta-require.js",
  },
  babelConfigMap: {
    "transform-block-scoping": [blockScoping],
  },
  compileGroupCount: 1,
  minify: false,
  verbose: true,
})
