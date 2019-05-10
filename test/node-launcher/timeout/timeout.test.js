import { assert } from "@dmail/assert"
import { hrefToFolderJsenvRelative } from "../../../src/hrefToFolderJsenvRelative.js"
import { ROOT_FOLDER } from "../../../src/ROOT_FOLDER.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const testFolderRelative = hrefToFolderJsenvRelative(import.meta.url)
const projectFolder = ROOT_FOLDER
const compileInto = `${testFolderRelative}/.dist`
const filenameRelative = `${testFolderRelative}/timeout.js`

const { origin: compileServerOrigin } = await startCompileServer({
  projectFolder,
  compileInto,
  verbose: false,
})

const actual = await launchAndExecute({
  launch: (options) => launchNode({ ...options, projectFolder, compileInto, compileServerOrigin }),
  allocatedMs: 5000,
  captureConsole: true,
  filenameRelative,
  verbose: false,
})
actual.platformLog = removeDebuggerLog(actual.platformLog)
const expected = {
  status: "timedout",
  platformLog: `foo
`,
}
assert({ actual, expected })
