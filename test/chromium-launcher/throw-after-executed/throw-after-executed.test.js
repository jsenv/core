import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileInto = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/throw-after-executed.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectPath,
  compileInto,
  logLevel: "off",
})

let afterExecuteError
const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({
      ...options,
      projectPath,
      compileInto,
      compileServerOrigin,
    }),
  errorAfterExecutedCallback: (error) => {
    afterExecuteError = error
  },
  stopOnError: true,
  fileRelativePath,
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
