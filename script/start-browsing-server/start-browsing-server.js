const { startBrowsingServer } = require("@jsenv/core")
const {
  importMap,
  projectFolder,
  compileInto,
  babelPluginDescription,
} = require("../../jsenv.config.js")

const browsableDescription = {
  "/index.js": true,
  "/src/**/*.js": true,
  "/test/**/*.js": true,
}

startBrowsingServer({
  importMap,
  projectFolder,
  compileInto,
  babelPluginDescription,
  browsableDescription,
  protocol: "http",
  ip: "127.0.0.1",
  port: 3456,
  forcePort: true,
})
