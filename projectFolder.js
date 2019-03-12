const { normalizePathname } = require("@jsenv/module-resolution")

const compileFolder = "dist"
const currentFolderPathname = normalizePathname(__dirname)
const projectFolder = currentFolderPathname.endsWith(compileFolder)
  ? currentFolderPathname.slice(0, -(compileFolder.length + 1))
  : currentFolderPathname

exports.projectFolder = projectFolder
