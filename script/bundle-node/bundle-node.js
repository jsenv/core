const { bundleNode } = require("@jsenv/core")
const { importMap, projectFolder } = require("../../jsenv.config.js")

bundleNode({
  importMap,
  projectFolder,
  into: "dist/node",
  babelPluginDescription: {},
  entryPointsDescription: {
    main: "index.js",
  },
  verbose: true,
  compileGroupCount: 1,
})
