const {
  startBrowserExecutionServer,
} = require("../dist/src/server-browser/startBrowserExecutionServer.js")
const { localRoot } = require("../dist/src/localRoot.js")

const compileInto = "build"
const babelPluginDescription = {}

startBrowserExecutionServer({
  executablePatternMapping: {
    "index.js": true,
    "src/**/*.js": true,
  },
  localRoot,
  compileInto,
  babelPluginDescription,
})
