/* eslint-disable import/no-unresolved */
const { execute, launchChromium } = require("@jsenv/core")

execute({
  projectPath: __dirname,
  launch: launchChromium,
  fileRelativeUrl: process.argv[2],
  stopOnceExecuted: true,
})
