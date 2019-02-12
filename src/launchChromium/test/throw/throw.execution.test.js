import { assert } from "@dmail/assert"
import { localRoot } from "../../../localRoot.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const file = `src/launchChromium/test/throw/throw.js`
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
    file,
    verbose: true,
    platformTypeForLog: "chromium browser",
  })
  const expected = {
    status: "errored",
    error: {
      message: "error",
      stack: actual.error.stack,
    },
  }
  assert({ actual, expected })
})()
