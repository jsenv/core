import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `syntax-error.js`
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
    launchChromium({
      ...options,
      compileInto,
      sourceOrigin,
      compileServerOrigin,
      headless: false,
    }),
  stopOnceExecuted: true,
  filenameRelative,
  verbose: false,
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
