const { bundleNode } = require("@jsenv/core")
const { importMap, projectFolder, babelConfigMap } = require("../../jsenv.config.js")

bundleNode({
  importMap,
  projectFolder,
  into: "dist/node-client",
  babelConfigMap,
  entryPointMap: {
    main: "src/launchNode/client.js",
  },
  compileGroupCount: 1,
  verbose: true,
})
