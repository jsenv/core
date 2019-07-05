const { startExploringServer } = require("@jsenv/core")
const { projectPath } = require("../../jsenv.config.js")

startExploringServer({
  projectPath,
  port: 3456,
  forcePort: true,
})
