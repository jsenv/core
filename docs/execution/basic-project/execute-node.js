/* eslint-disable import/no-unresolved */
const { execute } = require("@jsenv/execution")
const { launchNode } = require("@jsenv/node-launcher")

execute({
  projectPath: __dirname,
  launch: launchNode,
  fileRelativePath: `/${process.argv[2]}`,
})
