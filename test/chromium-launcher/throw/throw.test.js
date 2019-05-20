import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"

const projectPath = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileInto = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/throw.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectPath,
  compileInto,
  logLevel: "off",
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchChromium({
      ...options,
      projectPath,
      compileInto,
      compileServerOrigin,
    }),
  stopOnceExecuted: true,
  fileRelativePath,
})
const expected = {
  status: "errored",
  error: new Error("error"),
}
assert({ actual, expected })
