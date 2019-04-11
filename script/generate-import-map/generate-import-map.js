const { fileWrite } = require("@dmail/helper")
const { generateImportMapForProjectNodeModules } = require("@jsenv/core")
const { projectFolder } = require("../../jsenv.config.js")

generateImportMapForProjectNodeModules({
  projectFolder,
  logDuration: true,
}).then((importMap) => {
  const importMapSource = JSON.stringify(importMap, null, "  ")
  fileWrite(`${projectFolder}/importMap.json`, importMapSource)
})
