import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { launchChromium, launchAndExecute, startCompileServer } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `log.js`
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
  launch: (options) =>
    launchChromium({
      ...options,
      compileInto,
      sourceOrigin,
      compileServerOrigin,
      headless: false,
    }),
  stopOnceExecuted: true,
  captureConsole: true,
  filenameRelative,
  verbose: false,
})
const expected = {
  status: "completed",
  platformLog: `foo
bar
`,
}
assert({ actual, expected })
