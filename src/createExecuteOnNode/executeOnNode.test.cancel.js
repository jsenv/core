import { executeOnNode } from "./executeOnNode.js"
import path from "path"
import { createJsCompileService } from "../createJsCompileService.js"
import { createCancellationSource } from "../cancellation-source/index.js"

const localRoot = path.resolve(__dirname, "../../../")
const compileInto = "build"
const watch = true
const file = `src/__test__/file.js`

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
  })
}

const { token, cancel } = createCancellationSource()
exec({ cancellationToken: token })

process.on("SIGINT", () => {
  cancel("process interrupt").then(() => {
    process.exit(0)
  })
})
