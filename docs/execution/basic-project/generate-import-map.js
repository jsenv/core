const { generateImportMapForProjectNodeModules } = require("@jsenv/node-module-import-map")

generateImportMapForProjectNodeModules({
  projectPath: __dirname,
})
