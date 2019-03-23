import { assert } from "@dmail/assert"
import { projectFolder } from "../../../../projectFolder.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const testFolder = `${projectFolder}/src/launchChromium/test/syntax-error`
const filenameRelative = `syntax-error.js`
const compileInto = ".dist"
const babelPluginDescription = {}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
    projectFolder: testFolder,
    compileInto,
    babelPluginDescription,
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
    mirrorConsole: true,
    filenameRelative,
    verbose: true,
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
