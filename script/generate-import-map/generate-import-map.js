const { generateImportMapForProjectPackage } = require("@jsenv/node-module-import-map")
const jsenvConfig = require("../../jsenv.config.js")

generateImportMapForProjectPackage({
  ...jsenvConfig,
  includeDevDependencies: true,
  includeImports: true,
  includeExports: true,
  importMapFile: true,
  jsConfigFile: true,
})
