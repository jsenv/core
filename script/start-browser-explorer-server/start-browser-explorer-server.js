const { startBrowserExplorerServer } = require("@jsenv/core")
const { projectPath } = require("../../jsenv.config.js")

startBrowserExplorerServer({
  projectFolder: projectPath,
  port: 3456,
  forcePort: true,
})
