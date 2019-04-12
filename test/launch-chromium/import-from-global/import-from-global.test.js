import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { launchAndExecute, launchChromium, startCompileServer } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `import-from-global.js`
const compileInto = ".dist"
const babelConfigMap = {}

const sourceOrigin = `file://${projectFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
  stopOnceExecuted: true,
  collectNamespace: true,
  filenameRelative,
})
const expected = {
  status: "completed",
  namespace: {
    default: 42,
  },
}
assert({ actual, expected })
