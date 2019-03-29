const { bundleNode } = require("@jsenv/core")
const { importMap, projectFolder, babelPluginDescription } = require("../../jsenv.config.js")

bundleNode({
  importMap,
  projectFolder,
  into: "dist/node",
  babelPluginDescription,
  entryPointsDescription: {
    main: "index.js",
  },
  verbose: true,
})
