const { bundleNode } = require("@jsenv/core")
const { projectFolder, babelConfigMap } = require("../../jsenv.config.js")

bundleNode({
  projectFolder,
  into: "dist/node-client",
  babelConfigMap,
  entryPointMap: {
    nodeClient: "src/launchNode/client.js",
  },
  compileGroupCount: 1,
  verbose: false,
})
