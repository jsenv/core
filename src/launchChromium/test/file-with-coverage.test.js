import { assert } from "@dmail/assert"
import { createCancellationSource } from "@dmail/cancellation"
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

const exec = async () => {
  const { token: cancellationToken, cancel } = createCancellationSource()

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
  const result = await executeFileOnPlatform(
    file,
    () =>
      launchChromium({
        cancellationToken,
        localRoot,
        headless: false,
        remoteRoot,
        compileInto,
      }),
    {
      platformTypeForLog: "chromium browser",
      cancellationToken,
      verbose,
      collectNamespace: true,
      collectCoverage: true,
    },
  )
  assert({
    actual: result,
    expected: {
      namespace: { default: true },
      coverageMap: {
        "src/launchChromium/test/fixtures/file.js":
          result.coverageMap["src/launchChromium/test/fixtures/file.js"],
      },
    },
  })
  cancel("done")
}

exec()
