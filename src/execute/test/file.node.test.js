import { projectFolder } from "../../../projectFolder.js"
import { launchNode } from "../../launchNode/index.js"
import { execute } from "../execute.js"

execute({
  projectFolder,
  compileInto: "build",
  babelPluginDescription: {},
  launch: launchNode,
  filenameRelative: "src/execute/test/file.js",
})
