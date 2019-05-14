import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`
const filenameRelative = `${testFolderRelative}/disconnect.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileInto,
  logLevel: "off",
})

const actual = await launchAndExecute({
  launch: (options) =>
    launchNode({
      ...options,
      projectFolder,
      compileServerOrigin,
      compileInto,
    }),
  captureConsole: true,
  filenameRelative,
})
actual.platformLog = removeDebuggerLog(actual.platformLog)
const expected = {
  status: "disconnected",
  platformLog: `here
`,
}
assert({ actual, expected })
