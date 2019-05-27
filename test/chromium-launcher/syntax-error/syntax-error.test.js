import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { JSENV_PATHNAME } from "../../../src/JSENV_PATH.js"
import { importMetaURLToFolderJsenvRelativePath } from "../../../src/import-meta-url-to-folder-jsenv-relative-path.js"
import { startCompileServer, launchAndExecute, launchChromium } from "../../../index.js"
import { assignNonEnumerableProperties } from "/test/node-launcher/assignNonEnumerableProperties.js"
import {
  CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
  CHROMIUM_LAUNCHER_TEST_PARAM,
} from "../chromium-launcher-test-param.js"

const folderJsenvRelativePath = importMetaURLToFolderJsenvRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderJsenvRelativePath}/.dist`
const compileId = "otherwise"
const fileRelativePath = `${folderJsenvRelativePath}/syntax-error.js`

const { origin: compileServerOrigin } = await startCompileServer({
  ...CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
})

const actual = await launchAndExecute({
  ...CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
  launch: (options) =>
    launchChromium({
      ...CHROMIUM_LAUNCHER_TEST_PARAM,
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
        columnNumber: 17,
      },
      code: "MODULE_PARSE_ERROR",
    },
  ),
}
assert({ actual, expected })
