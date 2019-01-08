import { localRoot } from "../../localRoot.js"
import { createJsCompileService } from "../../createJsCompileService.js"
import { open as compileServerOpen } from "../../server-compile/index.js"
import { executeFileOnPlatform } from "../../executeFileOnPlatform/executeFileOnPlatform.js"
import { launchNode } from "../launchNode.js"

const file = `src/launchNode/test/fixtures/close-later.js`
const compileInto = "build"
const hotreload = false

const exec = async ({ cancellationToken }) => {
  const jsCompileService = await createJsCompileService({
    cancellationToken,
    localRoot,
    compileInto,
    watch: hotreload,
  })

  const { origin: remoteRoot } = await compileServerOpen({
    cancellationToken,
    protocol: "http",

    localRoot,
    compileInto,
    compileService: jsCompileService,
  })

  const verbose = true
  executeFileOnPlatform(
    file,
    () => launchNode({ cancellationToken, localRoot, remoteRoot, compileInto }),
    {
      platformTypeForLog: "node process",
      cancellationToken,
      verbose,
    },
  )
}

exec({})
