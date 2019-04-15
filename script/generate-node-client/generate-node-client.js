const { bundleNode } = require("@jsenv/core")
const { projectFolder } = require("../../jsenv.config.js")

bundleNode({
  projectFolder,
  into: "dist/node-client",
  entryPointMap: {
    nodeClient: "src/launchNode/client.js",
  },
  compileGroupCount: 1,
  verbose: false,
})
