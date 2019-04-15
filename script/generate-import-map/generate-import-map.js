const { generateImportMapForProjectNodeModules } = require("@jsenv/core")
const { projectFolder, importMapFilenameRelative } = require("../../jsenv.config.js")

generateImportMapForProjectNodeModules({ projectFolder, importMapFilenameRelative })
