import { projectFolder } from "../../../projectFolder.js"
import { launchNode } from "../../launchNode/index.js"
import { execute } from "../execute.js"

const testFolder = `${projectFolder}/src/execute/test`

execute({
  projectFolder: testFolder,
  compileInto: ".dist",
  babelConfigMap: {},
  launch: launchNode,
  filenameRelative: "file.js",
})
