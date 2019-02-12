import { assert } from "@dmail/assert"
import { localRoot } from "../../../localRoot.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const file = `src/launchChromium/test/not-found/not-found.js`
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
    status: "errored",
    error: {
      code: "MODULE_NOT_FOUND_ERROR",
      message: `src/launchChromium/test/not-found/foo.js not found`,
      stack: actual.error.stack,
      url: `${remoteRoot}/${compileInto}/best/src/launchChromium/test/not-found/foo.js`,
    },
  }
  assert({ actual, expected })
})()
