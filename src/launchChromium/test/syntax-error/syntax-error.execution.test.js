import { assert } from "@dmail/assert"
import { root } from "../../../root.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const file = `src/launchChromium/test/syntax-error/syntax-error.js`
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
    file,
    verbose: true,
    platformTypeForLog: "chromium browser",
  })
  const expected = {
    status: "errored",
    error: {
      code: "MODULE_PARSE_ERROR",
      message: actual.error.message,
      messageHTML: actual.error.messageHTML,
      stack: actual.error.stack,
      columnNumber: 17,
      fileName: "src/launchChromium/test/syntax-error/syntax-error.js",
      lineNumber: 1,
    },
  }
  assert({ actual, expected })
})()
