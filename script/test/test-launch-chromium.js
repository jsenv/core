const { test } = require("@jsenv/testing")
const { launchNode } = require("@jsenv/node-launcher")
const { projectPath } = require("../../jsenv.config.js")

test({
  projectPath,
  executeDescription: {
    "/test/launchChromium/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
    "/test/launchChromiumTab/**/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
