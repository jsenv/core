const { fileWrite } = require("@dmail/helper")
const { generateImportMapForProjectNodeModules } = require("@jsenv/core")
const { projectFolder } = require("../../jsenv.config.js")

generateImportMapForProjectNodeModules({
  projectFolder,
  logDuration: true,
}).then((importMap) => {
  fileWrite(`${projectFolder}/importMap.json`, JSON.stringify(importMap, null, "  "))
})
