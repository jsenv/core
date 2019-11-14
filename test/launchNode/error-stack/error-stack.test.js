import { assert } from "@jsenv/assert"
import { launchNode, launchNodeProjectPathname } from "../../index.js"
import {
  NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  NODE_LAUNCHER_TEST_PARAM,
} from "../node-launcher-test-param.js"
import { selfHrefToFolderRelativePath } from "../self-href-to-folder-relative-path.js"

const { startCompileServer } = import.meta.require("@jsenv/compile-server")
const { launchAndExecute } = import.meta.require("@jsenv/execution")

const folderRelativePath = selfHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const fileRelativePath = `${folderRelativePath}/throw.js`

const { origin: compileServerOrigin } = await startCompileServer({
  ...NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
})

const result = await launchAndExecute({
  ...NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  // mirrorConsole: true,
  launch: (options) =>
    launchNode({
      ...NODE_LAUNCHER_TEST_PARAM,
      ...options,
      compileServerOrigin,
      compileIntoRelativePath,
    }),
  fileRelativePath,
})

const stack = result.error.stack
const expected = `Error: error
  at triggerError (file://${launchNodeProjectPathname}${folderRelativePath}/trigger-error.js:2:9)
  at Object.triggerError (file://${launchNodeProjectPathname}${folderRelativePath}/throw.js:3:1)
  at call (file://${launchNodeProjectPathname}/node_modules/@jsenv/compile-server/src/startCompileServer/s.js:358:34)
  at doExec (file://${launchNodeProjectPathname}/node_modules/@jsenv/compile-server/src/startCompileServer/s.js:354:12)
  at postOrderExec (file://${launchNodeProjectPathname}/node_modules/@jsenv/compile-server/src/startCompileServer/s.js:317:14)
  at processTicksAndRejections (internal/process/task_queues.js:93:5)`
const actual = stack.slice(0, expected.length)
assert({ actual, expected })
