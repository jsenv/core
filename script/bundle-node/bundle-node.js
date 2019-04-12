const { bundleNode } = require("@jsenv/core")
const { projectFolder } = require("../../jsenv.config.js")

bundleNode({
  projectFolder,
  into: "dist/node",
  babelConfigMap: {},
  entryPointMap: {
    main: "index.js",
  },
  verbose: true,
  compileGroupCount: 1,
})
