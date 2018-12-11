import { localRoot } from "../localRoot.js"
import { createJsCompileService } from "../createJsCompileService.js"
import { open as compileServerOpen } from "../server-compile/index.js"
import { executeFileOnPlatform } from "../executeFileOnPlatform/executeFileOnPlatform.js"
import { launchNode } from "./launchNode.js"

const compileInto = "build"
const hotreload = false
const file = `src/__test__/file.js`

const exec = async ({ cancellationToken }) => {
  const jsCompileService = await createJsCompileService({
    cancellationToken,
    localRoot,
    compileInto,
    watch: hotreload,
  })

  const server = await compileServerOpen({
    cancellationToken,
    protocol: "http",

    localRoot,
    compileInto,
    compileService: jsCompileService,
  })

  const remoteRoot = server.origin
  const verbose = true
  return executeFileOnPlatform(file, {
    launchPlatform: () => launchNode({ cancellationToken, localRoot, remoteRoot, compileInto }),
    platformTypeForLog: "node",
    cancellationToken,
    verbose,
  })
}

exec({})
