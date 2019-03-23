import { assert } from "@dmail/assert"
import transformAsyncToPromises from "babel-plugin-transform-async-to-promises"
import { projectFolder } from "../../../../projectFolder.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchChromium } from "../../launchChromium"

const testFolder = `${projectFolder}/src/launchChromium/test/timeout`
const filenameRelative = `timeout.js`
const compileInto = ".dist"
const babelPluginDescription = {
  "transform-async-to-promises": [transformAsyncToPromises],
}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelPluginDescription,
  })

  const actual = await launchAndExecute({
    launch: ({ cancellationToken }) =>
      launchChromium({
        cancellationToken,
        compileInto,
        sourceOrigin,
        compileServerOrigin,
        headless: false,
      }),
    allocatedMs: 5000,
    stopOnceExecuted: true,
    captureConsole: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "timedout",
    platformLog: `foo
`,
  }
  assert({ actual, expected })
})()
