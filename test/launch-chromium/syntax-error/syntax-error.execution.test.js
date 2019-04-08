import { assert } from "/node_modules/@dmail/assert/index.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const { projectFolder } = import.meta.require("../../../jsenv.config.js")

const testFolder = `${projectFolder}/test/launch-chromium/syntax-error`
const filenameRelative = `syntax-error.js`
const compileInto = ".dist"
const babelConfigMap = {}

;(async () => {
  const sourceOrigin = `file://${testFolder}`

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
      message: `error while parsing module.
href: ${compileServerOrigin}/${compileInto}/otherwise/${filenameRelative}
importerHref: undefined
parseErrorMessage: ${actual.error.parseError.message}`,
      href: `${compileServerOrigin}/${compileInto}/otherwise/${filenameRelative}`,
      parseError: {
        name: "PARSE_ERROR",
        message: actual.error.parseError.message,
        messageHTML: actual.error.parseError.messageHTML,
        href: `${compileServerOrigin}/${compileInto}/otherwise/${filenameRelative}`,
        lineNumber: 1,
        columnNumber: 17,
      },
      code: "MODULE_PARSE_ERROR",
    },
  }
  assert({ actual, expected })
})()
