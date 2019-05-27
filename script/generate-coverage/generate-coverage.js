const { cover, launchNode } = require("@jsenv/core")
const { projectPath } = require("../../jsenv.config.js")

cover({
  projectPath,
  executeDescription: {
    "/test/node-launcher/log/*.test.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
