import { assert } from "@dmail/assert"
import { pluginOptionMapToPluginMap } from "@dmail/project-structure-compile-babel"
import { localRoot } from "../../../localRoot.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const file = `src/launchChromium/test/shared-node-module/shared-node-module.js`
const compileInto = "build"
const pluginMap = pluginOptionMapToPluginMap({
  "transform-modules-systemjs": {},
})

;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    localRoot,
    compileInto,
    pluginMap,
  })

  const actual = await launchAndExecute(
    () => launchChromium({ localRoot, remoteRoot, compileInto, headless: false }),
    file,
    {
      platformTypeForLog: "chromium browser",
      verbose: true,
      stopOnceExecuted: true,
      mirrorConsole: true,
      collectNamespace: true,
    },
  )
  const expected = {
    status: "completed",
    namespace: {
      foo: "foo",
    },
  }
  assert({ actual, expected })
})()
