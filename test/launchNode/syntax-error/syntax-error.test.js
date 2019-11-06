import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { launchNode, launchNodeProjectPathname } from "../../index.js"
import { selfHrefToFolderRelativePath } from "../self-href-to-folder-relative-path.js"
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
const compileId = "best"
const fileRelativePath = `${folderRelativePath}/syntax-error.js`

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
    new Error(`main module parsing error.
href: file://${launchNodeProjectPathname}${compileIntoRelativePath}/${compileId}${fileRelativePath}
parsing error message: ${actual.error.parsingError.message}`),
    {
      code: "MODULE_PARSING_ERROR",
      href: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${fileRelativePath}`,
      parsingError: {
        message: actual.error.parsingError.message,
        messageHTML: actual.error.parsingError.messageHTML,
        filename: pathnameToOperatingSystemPath(`${launchNodeProjectPathname}${fileRelativePath}`),
        lineNumber: 1,
        columnNumber: 14,
      },
    },
  ),
}
assert({ actual, expected })
