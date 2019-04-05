const { startBrowsingServer } = require("@jsenv/core")
const { importMap, projectFolder, compileInto, babelConfigMap } = require("../../jsenv.config.js")

const browsableDescription = {
  "/index.js": true,
  "/src/**/*.js": true,
  "/test/**/*.js": true,
}

startBrowsingServer({
  importMap,
  projectFolder,
  compileInto,
  babelConfigMap,
  browsableDescription,
  protocol: "http",
  ip: "127.0.0.1",
  port: 3456,
  forcePort: true,
})
