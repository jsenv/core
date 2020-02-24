import { basename } from "path"
import { assert } from "@jsenv/assert"
import { createLogger } from "@jsenv/logger"
import { resolveUrl, urlToRelativeUrl, urlToFileSystemPath } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startCompileServer } from "../../../src/internal/compiling/startCompileServer.js"
import { launchAndExecute } from "../../../src/internal/executing/launchAndExecute.js"
import { launchChromium, launchFirefox, launchWebkit } from "../../../index.js"
import {
  START_COMPILE_SERVER_TEST_PARAMS,
  EXECUTION_TEST_PARAMS,
  LAUNCH_TEST_PARAMS,
} from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryname}.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const fileUrl = resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl)
const filePath = urlToFileSystemPath(fileUrl)
const { origin: compileServerOrigin, outDirectoryRelativeUrl } = await startCompileServer({
  ...START_COMPILE_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  compileGroupCount: 1,
})

await Promise.all(
  [launchChromium, launchFirefox, launchWebkit].map(async (launchBrowser) => {
    const result = await launchAndExecute({
      ...EXECUTION_TEST_PARAMS,
      executeLogger: createLogger({ logLevel: "off" }),
      launch: (options) =>
        launchBrowser({
          ...LAUNCH_TEST_PARAMS,
          ...options,
          outDirectoryRelativeUrl,
          compileServerOrigin,
        }),
      fileRelativeUrl,
    })
    const actual = {
      status: result.status,
      errorMessage: result.error.message,
      errorParsingErrror: result.error.parsingError,
    }
    const expected = {
      status: "errored",
      errorMessage: `imported module parsing error.
--- parsing error message ---
${filePath}: Unexpected token (1:17)

> 1 | const browser = (
    |                  ^
--- url ---
${jsenvCoreDirectoryUrl}${jsenvDirectoryRelativeUrl}out/otherwise/${fileRelativeUrl}
--- importer url ---
undefined`,
      errorParsingErrror: {
        message: `${filePath}: Unexpected token (1:17)

> 1 | const browser = (
    |                  ^`,
        messageHTML: `${filePath}: Unexpected token (1:17)

> 1 | const browser = (
    |                  ^`,
        filename: filePath,
        lineNumber: 1,
        columnNumber: 17,
      },
    }
    assert({ actual, expected })
  }),
)
