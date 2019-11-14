/* eslint-disable import/no-unresolved */
const { execute } = require("@jsenv/execution")
const { launchChromium } = require("@jsenv/chromium-launcher")

execute({
  projectPath: __dirname,
  launch: launchChromium,
  fileRelativePath: `/${process.argv[2]}`,
  stopOnceExecuted: true,
})
