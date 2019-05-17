import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATH } from "../../../src/JSENV_PATH.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const projectFolder = JSENV_PATH
const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/timeout.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileIntoRelativePath,
  logLevel: "off",
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchNode({ ...options, compileServerOrigin, projectFolder, compileIntoRelativePath }),
  allocatedMs: 5000,
  captureConsole: true,
  fileRelativePath,
})
actual.platformLog = removeDebuggerLog(actual.platformLog)
const expected = {
  status: "timedout",
  platformLog: `foo
`,
}
assert({ actual, expected })
