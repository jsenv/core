import { executeOnNode } from "./executeOnNode.js"
import path from "path"
import { createJSCompileServiceForProject } from "../createJSCompileServiceForProject.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const watch = true
const file = `src/__test__/file.js`

const exec = async ({ cancellation }) => {
  const { compileService, watchPredicate, groupMapFile } = await createJSCompileServiceForProject({
    cancellation,
    localRoot,
    compileInto,
  })

  return executeOnNode({
    cancellation,
    localRoot,
    compileInto,
    compileService,
    groupMapFile,

    watch,
    watchPredicate,

    file,
    verbose: true,
  })
}

exec({})
