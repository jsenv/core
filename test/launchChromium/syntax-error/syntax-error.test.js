import { assert } from "@dmail/assert"
import { pathnameToOperatingSystemPath } from "@jsenv/operating-system-path"
import { launchChromium, launchChromiumProjectPathname } from "../../index.js"
import {
  CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  CHROMIUM_LAUNCHER_TEST_PUPPETEER_PARAM,
  CHROMIUM_LAUNCHER_TEST_EXECUTION_PARAM,
  CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
} from "../chromium-launcher-test-param.js"
import { selfHrefToFolderRelativePath } from "../self-href-to-folder-relative-path.js"
import { assignNonEnumerableProperties } from "../assignNonEnumerableProperties.js"

const { startCompileServer } = import.meta.require("@jsenv/compile-server")
const { launchAndExecute } = import.meta.require("@jsenv/execution")

const folderRelativePath = selfHrefToFolderRelativePath(import.meta.url)
const compileIntoRelativePath = `${folderRelativePath}/.dist`
const compileId = "otherwise"
const fileRelativePath = `${folderRelativePath}/syntax-error.js`

const { origin: compileServerOrigin } = await startCompileServer({
  ...CHROMIUM_LAUNCHER_TEST_COMPILE_SERVER_PARAM,
  compileIntoRelativePath,
})

const actual = await launchAndExecute({
  ...CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
  ...CHROMIUM_LAUNCHER_TEST_PUPPETEER_PARAM,
  ...CHROMIUM_LAUNCHER_TEST_EXECUTION_PARAM,
  launch: (options) =>
    launchChromium({
      ...CHROMIUM_LAUNCHER_TEST_LAUNCH_PARAM,
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
href: file://${launchChromiumProjectPathname}${compileIntoRelativePath}/${compileId}${fileRelativePath}
parsing error message: ${actual.error.parsingError.message}`),
    {
      code: "MODULE_PARSING_ERROR",
      href: `${compileServerOrigin}${compileIntoRelativePath}/${compileId}${fileRelativePath}`,
      parsingError: {
        message: actual.error.parsingError.message,
        messageHTML: actual.error.parsingError.messageHTML,
        filename: pathnameToOperatingSystemPath(
          `${launchChromiumProjectPathname}${fileRelativePath}`,
        ),
        lineNumber: 1,
        columnNumber: 17,
      },
    },
  ),
}
assert({ actual, expected })
