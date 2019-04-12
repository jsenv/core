const { fileWrite } = require("@dmail/helper")
const { generateImportMapForProjectNodeModules } = require("@jsenv/core")
const { projectFolder } = require("../../jsenv.config.js")

const importMapFilename = `${projectFolder}/importMap.json`

generateImportMapForProjectNodeModules({ projectFolder })
  .then((importMap) => fileWrite(importMapFilename, JSON.stringify(importMap, null, "  ")))
  .then(
    () => console.log(`-> ${projectFolder}/importMap.json`),
    (error) =>
      setTimeout(() => {
        throw error
      }),
  )
