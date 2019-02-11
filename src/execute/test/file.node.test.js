import { localRoot } from "../../localRoot.js"
import { launchNode } from "../../launchNode/index.js"
import { execute } from "../execute.js"

execute({
  file: "src/execute/test/file.js",
  localRoot,
  compileInto: "build",
  launch: launchNode,
})
