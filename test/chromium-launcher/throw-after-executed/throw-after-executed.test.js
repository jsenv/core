import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`
const filenameRelative = `${testFolderRelative}/throw-after-executed.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileInto,
  logLevel: "off",
})

let afterExecuteError
const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({
      ...options,
      projectFolder,
      compileInto,
      compileServerOrigin,
    }),
  errorAfterExecutedCallback: (error) => {
    afterExecuteError = error
  },
  stopOnError: true,
  filenameRelative,
})
const expected = {
  status: "completed",
}
assert({ actual, expected })

process.on("exit", () => {
  assert({
    actual: afterExecuteError,
    expected: new Error(afterExecuteError.message),
  })
})
