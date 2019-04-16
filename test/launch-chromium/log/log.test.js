import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { launchChromium, launchAndExecute, startCompileServer } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `log.js`
const compileInto = ".dist"

const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder: testFolder,
  compileInto,
  verbose: false,
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({
      ...options,
      compileInto,
      sourceOrigin,
      compileServerOrigin,
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
