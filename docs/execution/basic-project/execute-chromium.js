const { execute } = require("@jsenv/execution")
// eslint-disable-next-line import/no-unresolved
const { launchChromium } = require("@jsenv/chromium-launcher")

execute({
  projectPath: __dirname,
  launch: launchChromium,
  fileRelativePath: `/${process.argv[2]}`,
  stopOnceExecuted: true,
})
