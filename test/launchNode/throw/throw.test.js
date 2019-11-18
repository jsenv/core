import { assert } from "@jsenv/assert"
import { selfHrefToFolderRelativePath } from "../self-href-to-folder-relative-path.js"
import { launchNode } from "../../index.js"
import {
  NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  NODE_LAUNCHER_TEST_PARAM,
} from "../node-launcher-test-param.js"
import { removeDebuggerLog } from "../removeDebuggerLog.js"

const { startCompileServer } = import.meta.require("@jsenv/compile-server")
const { launchAndExecute } = import.meta.require("@jsenv/execution")

const folderRelativePath = selfHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const fileRelativeUrl = `${folderRelativePath}/throw.js`

const { origin: compileServerOrigin } = await startCompileServer({
  ...NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
})

const actual = await launchAndExecute({
  ...NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  launch: (options) =>
    launchNode({
      ...NODE_LAUNCHER_TEST_PARAM,
      ...options,
      compileServerOrigin,
      compileIntoRelativePath,
    }),
  fileRelativeUrl,
  captureConsole: true,
})
actual.platformLog = removeDebuggerLog(actual.platformLog)
const expected = {
  status: "errored",
  error: new Error("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"),
  platformLog: actual.platformLog,
}
assert({ actual, expected })

{
  const actual = actual.platformLog.includes("SPECIAL_STRING_UNLIKELY_TO_COLLIDE")
  const expected = false
  assert({ actual, expected })
}
