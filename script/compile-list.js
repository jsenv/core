const { forEachRessourceMatching } = require("@dmail/project-structure")
const projectConfig = require("../config/project.config.js")

const { localRoot, metaMap } = projectConfig

forEachRessourceMatching(
  localRoot,
  metaMap,
  ({ compile }) => compile,
  (ressource) => ressource,
).then((files) => {
  console.log("list of file to compile:")
  console.log(files.join("\n"))
})
