const { pluginOptionMapToPluginMap } = require("@dmail/project-structure-compile-babel")
const {
  startBrowserExecutionServer,
} = require("../dist/src/server-browser/startBrowserExecutionServer.js")
const { localRoot } = require("../dist/src/localRoot.js")

const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

startBrowserExecutionServer({
  executablePatternMapping: {
    "index.js": true,
    "src/**/*.js": true,
  },
  localRoot,
  compileInto,
  pluginMap,
})
