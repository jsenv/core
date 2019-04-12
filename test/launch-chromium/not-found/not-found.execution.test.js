import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { launchAndExecute, startCompileServer, launchChromium } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `not-found.js`
const compileInto = ".dist"
const babelConfigMap = {}

const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: () => launchChromium({ compileInto, sourceOrigin, compileServerOrigin, headless: false }),
  stopOnceExecuted: true,
  mirrorConsole: true,
  filenameRelative,
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
