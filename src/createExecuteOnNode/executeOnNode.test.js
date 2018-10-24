import path from "path"
import { executeOnNode } from "./executeOnNode.js"
import { createJSCompileServiceForProject } from "../createJSCompileServiceForProject.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const watch = true
const file = `src/__test__/file.js`

createJSCompileServiceForProject({ localRoot, compileInto }).then(
  ({ compileService, watchPredicate, groupMapFile }) => {
    return executeOnNode({
      localRoot,
      compileInto,
      compileService,
      groupMapFile,

      watch,
      watchPredicate,

      file,
      verbose: true,
    })
  },
)
