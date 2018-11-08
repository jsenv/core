import { executeOnNode } from "./executeOnNode.js"
import path from "path"
import { createJsCompileService } from "../createJsCompileService.js"
import { createCancel } from "../cancel/index.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const watch = false
const file = `src/__test__/file.js`
const { cancellation, cancel } = createCancel()

const exec = async ({ cancellation }) => {
  const jsCompileService = await createJsCompileService({
    cancellation,
    localRoot,
    compileInto,
  })

  return executeOnNode({
    cancellation,
    localRoot,
    compileInto,
    compileService: jsCompileService,
    watch,
    file,
    verbose: true,
  }).then(() => {
    cancel("executed")
  })
}

exec({ cancellation })
