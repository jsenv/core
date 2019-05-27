import { assert } from "@dmail/assert"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import {
  NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  NODE_LAUNCHER_TEST_PARAM,
} from "../node-launcher-test-param.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/throw-after-executed.js`

const { origin: compileServerOrigin } = await startCompileServer({
  ...NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
})

let afterExecuteError
const actual = await launchAndExecute({
  ...NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  launch: (options) =>
    launchNode({
      ...NODE_LAUNCHER_TEST_PARAM,
      ...options,
      compileServerOrigin,
      compileIntoRelativePath,
    }),
  captureConsole: true,
  fileRelativePath,
  collectNamespace: false,
  errorAfterExecutedCallback: (error) => {
    afterExecuteError = error
  },
})
actual.platformLog = removeDebuggerLog(actual.platformLog)
const expected = {
  status: "completed",
  platformLog: "",
}
assert({ actual, expected })

process.on("exit", () => {
  assert({
    actual: afterExecuteError,
    expected: new Error(`child exited with 1`),
  })
})
