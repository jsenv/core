import { assert } from "/node_modules/@dmail/assert/index.js"
import { projectFolder } from "../../../../projectFolder.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const file = `src/launchChromium/test/not-found/not-found.js`
const compileInto = ".dist"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: () =>
      launchChromium({ compileInto, sourceOrigin, compileServerOrigin, headless: false }),
    stopOnceExecuted: true,
    mirrorConsole: true,
    verbose: true,
    file,
  })
  const expected = {
    status: "errored",
    error: {
      code: "MODULE_NOT_FOUND_ERROR",
      message: `src/launchChromium/test/not-found/foo.js not found`,
      stack: actual.error.stack,
      url: `${compileServerOrigin}/${compileInto}/best/src/launchChromium/test/not-found/foo.js`,
    },
  }
  assert({ actual, expected })
})()
