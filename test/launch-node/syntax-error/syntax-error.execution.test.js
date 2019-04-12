import { hrefToPathname, pathnameToDirname } from "@jsenv/module-resolution"
import { assert } from "@dmail/assert"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"

const testFolder = pathnameToDirname(hrefToPathname(import.meta.url))
const filenameRelative = `syntax-error.js`
const compileInto = ".dist"
const compileIdOption = "otherwise"
const babelConfigMap = {}
const sourceOrigin = `file://${testFolder}`

const { origin: compileServerOrigin } = await startCompileServer({
  verbose: false,
  projectFolder: testFolder,
  compileInto,
  babelConfigMap,
})

const actual = await launchAndExecute({
  launch: (options) => launchNode({ ...options, compileInto, sourceOrigin, compileServerOrigin }),
  filenameRelative,
  verbose: false,
})
const expected = {
  status: "errored",
  error: {
    stack: actual.error.stack,
    message: `error while parsing module.
href: ${compileServerOrigin}/${compileInto}/${compileIdOption}/syntax-error.js
importerHref: undefined
parseErrorMessage: ${actual.error.parseError.message}`,
    href: `${compileServerOrigin}/${compileInto}/${compileIdOption}/syntax-error.js`,
    importerHref: undefined,
    parseError: {
      name: "PARSE_ERROR",
      message: actual.error.parseError.message,
      messageHTML: actual.error.parseError.messageHTML,
      href: `${compileServerOrigin}/${compileInto}/${compileIdOption}/syntax-error.js`,
      lineNumber: 1,
      columnNumber: 14,
    },
    code: "MODULE_PARSE_ERROR",
  },
}
assert({ actual, expected })
