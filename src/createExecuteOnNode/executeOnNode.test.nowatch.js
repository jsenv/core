import { executeOnNode } from "./executeOnNode.js"
import path from "path"
import { createJsCompileService } from "../createJsCompileService.js"
import { createCancellationSource } from "../cancellation/index.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const watch = false
const file = `src/__test__/file.js`
const { token, cancel } = createCancellationSource()

const exec = async ({ cancellationToken }) => {
  const jsCompileService = await createJsCompileService({
    cancellationToken,
    localRoot,
    compileInto,
  })

  return executeOnNode({
    cancellationToken,
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

exec({ cancellationToken: token })
