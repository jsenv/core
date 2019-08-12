const { execute } = require("@jsenv/core")
const { launchChromium } = require("@jsenv/chromium-launcher")

execute({
  projectPath: __dirname,
  launch: launchChromium,
  fileRelativePath: `/${process.argv[2]}`,
  stopOnceExecuted: true,
})
