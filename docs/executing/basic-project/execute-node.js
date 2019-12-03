/* eslint-disable import/no-unresolved */
const { execute, launchNode } = require("@jsenv/core")

execute({
  projectPath: __dirname,
  launch: launchNode,
  fileRelativeUrl: process.argv[2],
})
