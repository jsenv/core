const { bundleNode } = require("@jsenv/core")
const { importMap, projectFolder, babelPluginDescription } = require("../../jsenv.config.js")

bundleNode({
  importMap,
  projectFolder,
  into: "dist/node/node-client",
  babelPluginDescription,
  entryPointsDescription: {
    main: "src/launchNode/client.js",
  },
  compileGroupCount: 1,
  verbose: true,
})
