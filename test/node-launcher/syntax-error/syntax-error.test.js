import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { JSENV_PATHNAME } from "../../../src/JSENV_PATH.js"
import { startCompileServer, launchAndExecute, launchNode } from "../../../index.js"
import {
  NODE_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  NODE_LAUNCHER_TEST_LAUNCH_PARAM,
  NODE_LAUNCHER_TEST_PARAM,
} from "../node-launcher-test-param.js"
import { assignNonEnumerableProperties } from "../assignNonEnumerableProperties.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const compileId = "otherwise"
const fileRelativePath = `${folderJsenvRelativePath}/syntax-error.js`

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
    new Error(`error while parsing module.
href: file://${JSENV_PATHNAME}${compileIntoRelativePath}/${compileId}${fileRelativePath}
importerHref: undefined
parseErrorMessage: ${actual.error.parseError.message}`),
    {
      href: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${fileRelativePath}`,
      importerHref: undefined,
      parseError: {
        message: actual.error.parseError.message,
        messageHTML: actual.error.parseError.messageHTML,
        filename: pathnameToOperatingSystemPath(`${JSENV_PATHNAME}${fileRelativePath}`),
        lineNumber: 1,
        columnNumber: 14,
      },
      code: "MODULE_PARSE_ERROR",
    },
  ),
}
assert({ actual, expected })
