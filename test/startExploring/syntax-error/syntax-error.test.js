import { basename } from "path"
import { assert } from "@jsenv/assert"
import { urlToRelativeUrl, urlToFileSystemPath, resolveUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../../index.js"
import { openBrowserPage } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFilename = `${testDirectoryname}.main.html`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`
const importedFileRelativeUrl = `${testDirectoryRelativeUrl}${testDirectoryname}.main.js`
const importedFileUrl = resolveUrl(importedFileRelativeUrl, jsenvCoreDirectoryUrl)
const importedFilePath = urlToFileSystemPath(importedFileUrl)
const compileId = `best`

const exploringServer = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const compiledHtmlFileUrl = `${exploringServer.origin}/${exploringServer.outDirectoryRelativeUrl}${compileId}/${htmlFileRelativeUrl}`
const compiledImportedFileUrl = `${exploringServer.origin}/${exploringServer.outDirectoryRelativeUrl}${compileId}/${importedFileRelativeUrl}`

const { browser, pageLogs, pageErrors, executionResult } = await openBrowserPage(
  compiledHtmlFileUrl,
  {
    headless: false,
  },
)

const actual = { pageLogs, pageErrors, executionResult }
const expectedParsingErrorMessage = `${importedFilePath}: Unexpected token (1:17)

> 1 | const browser = (
    |                  ^`
const expectedParsingError = {
  message: expectedParsingErrorMessage,
  messageHTML: expectedParsingErrorMessage,
  filename: importedFilePath,
  lineNumber: 1,
  columnNumber: 17,
}
const expectedError = new Error(`Module file cannot be parsed.
--- parsing error message ---
${expectedParsingError.message}
--- file ---
${importedFileRelativeUrl}
--- file url ---
${compiledImportedFileUrl}`)
Object.assign(expectedError, {
  parsingError: expectedParsingError,
})
const expected = {
  pageLogs: [
    {
      type: "error",
      text: "Failed to load resource: the server responded with a status of 500 ()",
    },
    { type: "error", text: "JSHandle@error" },
  ],
  pageErrors: [],
  executionResult: {
    status: "errored",
    startTime: assert.any(Number),
    endTime: assert.any(Number),
    fileExecutionResultMap: {
      "@jsenv/core/src/toolbar.js": {
        status: "completed",
        namespace: {},
      },
      "./syntax-error.main.js": {
        status: "errored",
        exceptionSource: assert.any(String),
      },
    },
    error: expectedError,
  },
}
assert({ actual, expected })
// browser.close()
