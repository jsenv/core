import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const transformAsyncToPromises = import.meta.require("babel-plugin-transform-async-to-promises")

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `timeout.js`
const compileInto = ".dist"
const babelConfigMap = {
  "transform-async-to-promises": [transformAsyncToPromises],
}

const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  verbose: false,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: ({ cancellationToken }) =>
    launchChromium({
      cancellationToken,
      compileInto,
      sourceOrigin,
      compileServerOrigin,
    }),
  allocatedMs: 5000,
  stopOnceExecuted: true,
  captureConsole: true,
  filenameRelative,
  verbose: false,
})
const expected = {
  status: "timedout",
  platformLog: `foo
`,
}
assert({ actual, expected })
