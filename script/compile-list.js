const { readProjectMetaMap, forEachRessourceMatching } = require("@dmail/project-structure")
const path = require("path")

const root = path.resolve(__dirname, "../")
const config = "structure.config.js"
const predicate = ({ compile }) => compile

readProjectMetaMap({ root, config }).then((metaMap) => {
  return forEachRessourceMatching(root, metaMap, predicate, (data) => {
    return data.relativeName
  }).then((files) => {
    console.log("list of file to compile:")
    console.log(files.join("\n"))
  })
})
