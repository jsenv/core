import { executeOnNode } from "./executeOnNode.js"
import path from "path"
import { createJsCompileService } from "../createJsCompileService.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const hotreload = true
const file = `src/__test__/file.js`

const exec = async ({ cancellationToken }) => {
  const jsCompileService = await createJsCompileService({
    cancellationToken,
    localRoot,
    compileInto,
    watch: hotreload,
  })

  return executeOnNode({
    cancellationToken,
    localRoot,
    compileInto,
    compileService: jsCompileService,
    hotreload,
    file,
    verbose: true,
  })
}

exec({})
