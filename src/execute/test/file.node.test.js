import { root } from "../../root.js"
import { launchNode } from "../../launchNode/index.js"
import { execute } from "../execute.js"

execute({
  root,
  compileInto: "build",
  launch: launchNode,
  file: "src/execute/test/file.js",
})
