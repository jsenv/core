const { startBrowsingServer } = require("@jsenv/core")
const { projectFolder } = require("../../jsenv.config.js")

startBrowsingServer({
  projectFolder,
  protocol: "http",
  ip: "127.0.0.1",
  port: 3456,
  forcePort: true,
})
