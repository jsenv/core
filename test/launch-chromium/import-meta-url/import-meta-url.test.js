import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { launchAndExecute, startCompileServer, launchChromium } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `import-meta-url.js`
const compileInto = ".dist"
const babelConfigMap = {}

const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({ ...options, headless: false, compileInto, sourceOrigin, compileServerOrigin }),
  stopOnceExecuted: false,
  verbose: true,
  mirrorConsole: true,
  collectNamespace: true,
  filenameRelative,
})
const expected = {
  status: "completed",
  namespace: {
    default: `${compileServerOrigin}/${filenameRelative}`,
  },
}
assert({ actual, expected })
