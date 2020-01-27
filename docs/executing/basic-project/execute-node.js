/* global require, __dirname */
/* eslint-disable import/no-unresolved */
const { execute, launchNode } = require("@jsenv/core")

execute({
  projectDirectoryUrl: __dirname,
  launch: launchNode,
  fileRelativeUrl: process.argv[2],
})
