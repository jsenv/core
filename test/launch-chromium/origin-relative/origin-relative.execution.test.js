import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `folder/file.js`
const compileInto = ".dist"
const babelConfigMap = {}

const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  verbose: false,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: () => launchChromium({ compileInto, sourceOrigin, compileServerOrigin, headless: false }),
  stopOnceExecuted: true,
  filenameRelative,
  collectNamespace: true,
})
const expected = {
  status: "completed",
  namespace: {
    default: 42,
  },
}
assert({ actual, expected })
