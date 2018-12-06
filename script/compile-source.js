const { forEachRessourceMatching } = require("@dmail/project-structure")
const {
  compileFile,
  fileSystemWriteCompileResult,
} = require("@dmail/project-structure-compile-babel")
const projectConfig = require("../project.config.js")

const { localRoot, metaMap, plugins } = projectConfig
const outputFolder = `dist`

forEachRessourceMatching(
  localRoot,
  metaMap,
  ({ compile }) => compile,
  async (ressource) => {
    const { code, map } = await compileFile(ressource, {
      localRoot,
      plugins,
    })
    await fileSystemWriteCompileResult(
      {
        code,
        map,
      },
      {
        localRoot,
        outputFile: ressource,
        outputFolder,
      },
    )
    console.log(`${ressource} -> ${outputFolder}/${ressource}`)
  },
)
