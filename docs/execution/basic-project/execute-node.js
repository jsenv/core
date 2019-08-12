const { execute } = require("@jsenv/core")
const { launchNode } = require("@jsenv/node-launcher")

execute({
  projectPath: __dirname,
  launch: launchNode,
  fileRelativePath: `/${process.argv[2]}`,
})
