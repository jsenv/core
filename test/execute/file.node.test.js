import { execute, launchNode } from "../../index.js"

const { projectFolder } = import.meta.require("../../jsenv.config.js")

const testFolder = `${projectFolder}/test/execute`

execute({
  projectFolder: testFolder,
  compileInto: ".dist",
  babelConfigMap: {},
  launch: launchNode,
  filenameRelative: "file.js",
})
