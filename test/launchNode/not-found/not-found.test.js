import { assert } from "@jsenv/assert"
import { selfHrefToFolderRelativePath } from "../self-href-to-folder-relative-path.js"
import { launchNode, launchNodeProjectPathname } from "../../index.js"
import {
  NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  NODE_LAUNCHER_TEST_PARAM,
} from "../node-launcher-test-param.js"
import { assignNonEnumerableProperties } from "../assignNonEnumerableProperties.js"

const { startCompileServer } = import.meta.require("@jsenv/compile-server")
const { launchAndExecute } = import.meta.require("@jsenv/execution")

const folderRelativePath = selfHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const fileRelativeUrl = `${folderRelativePath}/not-found.js`
const compileId = "best"

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
})
const expected = {
  status: "errored",
  error: assignNonEnumerableProperties(
    new Error(`imported module not found.
href: file://${launchNodeProjectPathname}${compileIntoRelativePath}/${compileId}${folderRelativePath}/foo.js
importer href: file://${launchNodeProjectPathname}${compileIntoRelativePath}/${compileId}${fileRelativeUrl}`),
    {
      code: "MODULE_NOT_FOUND_ERROR",
      href: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${folderRelativePath}/foo.js`,
      importerHref: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${fileRelativeUrl}`,
    },
  ),
}
assert({ actual, expected })
