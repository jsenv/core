import { assert } from "@dmail/assert"
import { localRoot } from "../../../localRoot.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const file = `src/launchChromium/test/throw-after-executed/throw-after-executed.js`
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
    file,
  })
  const expected = {
    status: "completed",
  }
  assert({ actual, expected })
})()
