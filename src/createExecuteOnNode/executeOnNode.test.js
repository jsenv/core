import { executeOnNode } from "./executeOnNode.js"
import path from "path"
import { createJsCompileService } from "../createJsCompileService.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const hotreload = true
const file = `src/__test__/file.js`

const exec = async ({ cancellation }) => {
  const jsCompileService = await createJsCompileService({
    cancellation,
    localRoot,
    compileInto,
    watch: hotreload,
  })

  return executeOnNode({
    cancellation,
    localRoot,
    compileInto,
    compileService: jsCompileService,
    hotreload,
    file,
    verbose: true,
  })
}

exec({})
