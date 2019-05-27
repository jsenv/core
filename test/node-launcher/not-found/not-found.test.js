import { assert } from "@dmail/assert"
import { JSENV_PATHNAME } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import {
  NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  NODE_LAUNCHER_TEST_PARAM,
} from "../node-launcher-test-param.js"
import { assignNonEnumerableProperties } from "../assignNonEnumerableProperties.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const fileRelativePath = `${folderJsenvRelativePath}/not-found.js`
const compileId = "otherwise"

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
  status: "errored",
  error: assignNonEnumerableProperties(
    new Error(`module not found.
href: file://${JSENV_PATHNAME}${compileIntoRelativePath}/${compileId}${folderJsenvRelativePath}/foo.js
importerHref: file://${JSENV_PATHNAME}${compileIntoRelativePath}/${compileId}${fileRelativePath}`),
    {
      href: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${folderJsenvRelativePath}/foo.js`,
      importerHref: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${fileRelativePath}`,
      code: "MODULE_NOT_FOUND_ERROR",
    },
  ),
}
assert({ actual, expected })
