const { forEachRessourceMatching } = require("@dmail/project-structure")
const { pluginOptionMapToPluginMap } = require("@dmail/project-structure-compile-babel")
const { startBrowserServer } = require("../dist/src/server-browser/index.js")
const { localRoot } = require("../dist/src/localRoot.js")

const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})
const compileInto = "build"

;(async () => {
  const executableFiles = await forEachRessourceMatching({
    localRoot,
    metaMap: {
      "index.js": { js: true },
      "src/**/*.js": { js: true },
    },
    predicate: ({ js }) => js,
  })

  return startBrowserServer({
    localRoot,
    compileInto,
    pluginMap,
    executableFiles,
  })
})()
