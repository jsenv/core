import { assert } from "@dmail/assert"
import { root } from "../../../root.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const file = `src/launchNode/test/scoped-node-module/scoped-node-module.js`
const compileInto = "build"
const babelPluginDescription = {}
;(async () => {
  const { origin: remoteRoot } = await startCompileServer({
    root,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: () => launchChromium({ root, compileInto, remoteRoot, headless: false }),
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
