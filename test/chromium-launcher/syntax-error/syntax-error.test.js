import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"
import { assignNonEnumerableProperties } from "/test/node-launcher/assignNonEnumerableProperties.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`
const filenameRelative = `${testFolderRelative}/syntax-error.js`
const compileId = "otherwise"

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileInto,
  logLevel: "off",
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({
      ...options,
      projectFolder,
      compileInto,
      compileServerOrigin,
    }),
  stopOnceExecuted: true,
  filenameRelative,
})
const expected = {
  status: "errored",
  error: assignNonEnumerableProperties(
    new Error(`error while parsing module.
href: file://${projectFolder}/${compileInto}/${compileId}/${filenameRelative}
importerHref: undefined
parseErrorMessage: ${actual.error.parseError.message}`),
    {
      href: `${compileServerOrigin}/${compileInto}/${compileId}/${testFolderRelative}/syntax-error.js`,
      importerHref: undefined,
      parseError: {
        message: actual.error.parseError.message,
        messageHTML: actual.error.parseError.messageHTML,
        filename: `${projectFolder}/${filenameRelative}`,
        outputFilename: `file://${projectFolder}/${compileInto}/${compileId}/${testFolderRelative}/syntax-error.js`,
        lineNumber: 1,
        columnNumber: 14,
      },
      code: "MODULE_PARSE_ERROR",
    },
  ),
}
assert({ actual, expected })
