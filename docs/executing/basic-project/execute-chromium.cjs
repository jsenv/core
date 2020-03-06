/* global require, __dirname */
/* eslint-disable import/no-unresolved */
const { execute, launchChromium } = require("@jsenv/core")

execute({
  projectDirectoryUrl: __dirname,
  launch: launchChromium,
  fileRelativeUrl: process.argv[2],
  stopAfterExecute: true,
})
