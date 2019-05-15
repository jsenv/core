const { generateImportMapForProjectNodeModules } = require("@jsenv/node-module-import-map")
const { projectFolder } = require("../../jsenv.config.js")

generateImportMapForProjectNodeModules({ projectFolder })
