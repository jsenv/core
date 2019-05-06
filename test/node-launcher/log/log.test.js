import { assert } from "@dmail/assert"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const projectFolder = ROOT_FOLDER
const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const compileInto = `${testFolderRelative}/.dist`
const filenameRelative = `${testFolderRelative}/log.js`

const { origin: compileServerOrigin } = await startCompileServer({
  verbose: false,
  projectFolder,
  compileInto,
})

const actual = await launchAndExecute({
  launch: (options) => launchNode({ ...options, projectFolder, compileInto, compileServerOrigin }),
  captureConsole: true,
  filenameRelative,
  verbose: false,
})
actual.platformLog = removeDebuggerLog(actual.platformLog)
const expected = {
  status: "completed",
  platformLog: `foo
bar
`,
}
assert({ actual, expected })
