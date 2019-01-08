import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../localRoot.js"
import { createJsCompileService } from "../../createJsCompileService.js"
import { open as compileServerOpen } from "../../server-compile/index.js"
import { executeFileOnPlatform } from "../../executeFileOnPlatform/executeFileOnPlatform.js"
import { launchNode } from "../launchNode.js"

const file = `src/launchNode/test/fixtures/alive.js`
const compileInto = "build"
const hotreload = false
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

const exec = async ({ cancellationToken }) => {
  const jsCompileService = await createJsCompileService({
    cancellationToken,
    pluginMap,
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

  await executeFileOnPlatform(
    file,
    () => launchNode({ cancellationToken, localRoot, remoteRoot, compileInto }),
    {
      platformTypeForLog: "node process",
      cancellationToken,
      verbose,
      stopOnceExecuted: true,
    },
  )
  // close server to let process end if child ends
  server.close()
}

exec({})
