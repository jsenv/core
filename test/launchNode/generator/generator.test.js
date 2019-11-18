import { assert } from "@jsenv/assert"
import { selfHrefToFolderRelativePath } from "../self-href-to-folder-relative-path.js"
import { launchNode } from "../../index.js"
import {
  NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  NODE_LAUNCHER_TEST_PARAM,
} from "../node-launcher-test-param.js"

const { startCompileServer } = import.meta.require("@jsenv/compile-server")
const { launchAndExecute } = import.meta.require("@jsenv/execution")

const folderRelativePath = selfHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const fileRelativeUrl = `${folderRelativePath}/generator.js`

const { origin: compileServerOrigin } = await startCompileServer({
  ...NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
  compileGroupCount: 1, // force generator transformation
})

const actual = await launchAndExecute({
  ...NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  launch: (options) =>
    launchNode({
      ...NODE_LAUNCHER_TEST_PARAM,
      ...options,
      compileServerOrigin,
      compileIntoRelativePath,
      debugPort: 40001,
    }),
  fileRelativeUrl,
  collectNamespace: true,
})
const expected = {
  status: "completed",
  namespace: {
    default: 42,
  },
}
assert({ actual, expected })
