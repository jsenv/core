import { basename } from "path"
import { assert } from "@jsenv/assert"
import { createLogger } from "@jsenv/logger"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToFilePath,
  resolveUrl,
} from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { launchAndExecute } from "internal/executing/launchAndExecute.js"
import { launchChromium } from "../../../index.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)
const filePath = urlToFilePath(fileUrl)

const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

const actual = await launchAndExecute({
  ...EXECUTION_TEST_PARAMS,
  executeLogger: createLogger({ logLevel: "off" }),
  launch: (options) =>
    launchChromium({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    }),
  fileRelativeUrl,
})
const expectedError = new Error(`imported module parsing error.
--- parsing error message ---
${filePath}: Unexpected token (1:17)

> 1 | const browser = (
    |                  ^
--- url ---
${jsenvCoreDirectoryUrl}${jsenvDirectoryRelativeUrl}out/best/${fileRelativeUrl}
--- importer url ---
undefined`)
expectedError.parsingError = {
  message: `${filePath}: Unexpected token (1:17)

> 1 | const browser = (
    |                  ^`,
  messageHTML: `${filePath}: Unexpected token (1:17)

> 1 | const browser = (
    |                  ^`,
  filename: filePath,
  lineNumber: 1,
  columnNumber: 17,
}
const expected = {
  status: "errored",
  error: expectedError,
}
assert({ actual, expected })
