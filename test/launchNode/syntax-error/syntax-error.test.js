import { basename } from "path"
import { assert } from "@jsenv/assert"
import { createLogger } from "@jsenv/logger"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToFileSystemPath,
  resolveUrl,
} from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "internal/compiling/startCompileServer.js"
import { launchAndExecute } from "internal/executing/launchAndExecute.js"
import { launchNode } from "../../../index.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTE_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)
const filePath = urlToFileSystemPath(fileUrl)
const compiledFileUrl = `${jsenvCoreDirectoryUrl}${jsenvDirectoryRelativeUrl}out/best/${fileRelativeUrl}`

const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})

const actual = await launchAndExecute({
  ...EXECUTE_TEST_PARAMS,
  executeLogger: createLogger({ logLevel: "off" }),
  fileRelativeUrl,
  launch: (options) =>
    launchNode({
      ...LAUNCH_TEST_PARAMS,
      ...options,
      outDirectoryRelativeUrl,
      compileServerOrigin,
    }),
})
const expectedError = new Error(`imported module parsing error.
--- parsing error message ---
${filePath}: Unexpected token (1:14)

> 1 | const node = (
    |               ^
--- url ---
${compiledFileUrl}
--- importer url ---
undefined`)
expectedError.parsingError = {
  message: `${filePath}: Unexpected token (1:14)

> 1 | const node = (
    |               ^`,
  messageHTML: `${filePath}: Unexpected token (1:14)

> 1 | const node = (
    |               ^`,
  filename: filePath,
  lineNumber: 1,
  columnNumber: 14,
}
const expected = {
  status: "errored",
  error: expectedError,
}
assert({ actual, expected })
