const { startBrowserExplorerServer } = require("@jsenv/core")
const { projectFolder } = require("../../jsenv.config.js")

startBrowserExplorerServer({
  projectFolder,
  port: 3456,
  forcePort: true,
})
