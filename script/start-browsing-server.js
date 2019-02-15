// eslint-disable-next-line import/no-unresolved
const { startBrowsingServer } = require("../dist/index.js")
const { projectFolder } = require("./projectFolder.js")

const compileInto = "build"
const babelPluginDescription = {}

startBrowsingServer({
  projectFolder,
  compileInto,
  babelPluginDescription,
  browsableDescription: {
    "index.js": true,
    "src/**/*.js": true,
  },
  port: 3000,
  forcePort: true,
})
