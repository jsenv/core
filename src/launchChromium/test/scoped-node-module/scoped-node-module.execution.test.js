import { assert } from "@dmail/assert"
import { localRoot } from "../../../localRoot.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const file = `src/launchNode/test/scoped-node-module/scoped-node-module.js`
const compileInto = "build"
const pluginMap = {}
;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    localRoot,
    compileInto,
    pluginMap,
  })

  const actual = await launchAndExecute({
    launch: () => launchChromium({ localRoot, compileInto, remoteRoot, headless: false }),
    stopOnceExecuted: true,
    mirrorConsole: true,
    verbose: true,
    platformTypeForLog: "chromium browser",
    collectNamespace: true,
    file,
  })
  const expected = {
    status: "completed",
    namespace: {
      foo: "scoped-foo",
    },
  }
  assert({ actual, expected })
})()
