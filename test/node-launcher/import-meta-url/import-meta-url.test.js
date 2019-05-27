import { assert } from "@dmail/assert"
import { JSENV_PATHNAME } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import {
  NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  NODE_LAUNCHER_TEST_PARAM,
} from "../node-launcher-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/import-meta-url.js`

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
  fileRelativePath,
})
const expected = {
  status: "completed",
  namespace: {
    default: `file://${JSENV_PATHNAME}${fileRelativePath}`,
  },
}
assert({ actual, expected })
