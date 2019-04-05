const { bundleNode } = require("@jsenv/core")
const { importMap, projectFolder } = require("../../jsenv.config.js")

bundleNode({
  importMap,
  projectFolder,
  into: "dist/node",
  babelConfigMap: {},
  entryPointMap: {
    main: "index.js",
  },
  verbose: true,
  compileGroupCount: 1,
})
