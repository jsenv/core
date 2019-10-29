const { generateImportMapForProjectPackage } = require("@jsenv/node-module-import-map")
const { projectPath } = require("../../jsenv.config.js")

generateImportMapForProjectPackage({
  projectDirectoryPath: projectPath,
  includeDevDependencies: true,
  importMapFile: true,
  jsConfigFile: true,
})
