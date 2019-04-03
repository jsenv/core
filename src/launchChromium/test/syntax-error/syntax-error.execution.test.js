import { assert } from "/node_modules/@dmail/assert/index.js"
import { startCompileServer } from "../../../server-compile/index.js"
import { launchAndExecute } from "../../../launchAndExecute/index.js"
import { launchChromium } from "../../launchChromium.js"

const { projectFolder } = import.meta.require("../../../../jsenv.config.js")

const testFolder = `${projectFolder}/src/launchChromium/test/syntax-error`
const filenameRelative = `syntax-error.js`
const compileInto = ".dist"
const babelConfigMap = {}

;(async () => {
  const sourceOrigin = `file://${projectFolder}`

  const { origin: compileServerOrigin } = await startCompileServer({
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
    mirrorConsole: true,
    filenameRelative,
    verbose: true,
  })
  const expected = {
    status: "errored",
    error: {
      stack: actual.error.stack,
      message: `error while parsing file.
file: syntax-error.js
importerFile: undefined
parseErrorMessage: ${actual.error.parseError.message}`,
      file: "syntax-error.js",
      parseError: {
        name: "PARSE_ERROR",
        message: actual.error.parseError.message,
        fileName: "syntax-error.js",
        lineNumber: 1,
        columnNumber: 17,
        messageHTML: actual.error.parseError.messageHTML,
      },
      code: "MODULE_PARSE_ERROR",
    },
  }
  assert({ actual, expected })
})()
