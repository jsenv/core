import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../localRoot.js"
import { createJsCompileService } from "../../createJsCompileService.js"
import { open as compileServerOpen } from "../../server-compile/index.js"
import { executeFileOnPlatform } from "../../executeFileOnPlatform/executeFileOnPlatform.js"
import { launchChromium } from "../launchChromium.js"

const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})
const file = `src/launchChromium/test/fixtures/file.js`
const compileInto = "build"
const hotreload = false

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
  return executeFileOnPlatform(file, {
    launchPlatform: () =>
      launchChromium({ cancellationToken, localRoot, headless: false, remoteRoot, compileInto }),
    platformTypeForLog: "chromium browser",
    cancellationToken,
    verbose,
  }).finally(() => {
    // close server to let process end if child ends
    server.close()
  })
}

exec({})
