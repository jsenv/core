/* global require, __dirname */
/* eslint-disable import/no-unresolved */
const { execute, launchFirefox } = require("@jsenv/core")

execute({
  projectDirectoryUrl: __dirname,
  launch: launchFirefox,
  fileRelativeUrl: process.argv[2],
})
