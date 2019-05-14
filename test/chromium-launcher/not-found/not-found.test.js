import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"
import { assignNonEnumerableProperties } from "/test/node-launcher/assignNonEnumerableProperties.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`
const filenameRelative = `${testFolderRelative}/not-found.js`
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
    new Error(`module not found.
href: file://${projectFolder}/${compileInto}/${compileId}/${testFolderRelative}/foo.js
importerHref: file://${projectFolder}/${compileInto}/${compileId}/${testFolderRelative}/not-found.js`),
    {
      href: `${compileServerOrigin}/${compileInto}/${compileId}/${testFolderRelative}/foo.js`,
      importerHref: `${compileServerOrigin}/${compileInto}/${compileId}/${testFolderRelative}/not-found.js`,
      code: "MODULE_NOT_FOUND_ERROR",
    },
  ),
}
assert({ actual, expected })
