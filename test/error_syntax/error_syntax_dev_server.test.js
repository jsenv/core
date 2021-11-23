import { assert } from "@jsenv/assert"
import {
  urlToRelativeUrl,
  urlToFileSystemPath,
  resolveUrl,
} from "@jsenv/filesystem"

import { startDevServer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { START_DEV_SERVER_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_DEV_SERVER.js"
import { openBrowserPage } from "@jsenv/core/test/openBrowserPage.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFilename = `error_syntax.html`
const htmlFileRelativeUrl = `${testDirectoryRelativeUrl}${htmlFilename}`
const importedFileRelativeUrl = `${testDirectoryRelativeUrl}error_syntax.js`
const importedFileUrl = resolveUrl(
  importedFileRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const importedFilePath = urlToFileSystemPath(importedFileUrl)
const compileId = `best`

const devServer = await startDevServer({
  ...START_DEV_SERVER_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const compiledHtmlFileUrl = `${devServer.origin}/${devServer.outDirectoryRelativeUrl}${compileId}/${htmlFileRelativeUrl}`
const compiledImportedFileUrl = `${devServer.origin}/${devServer.outDirectoryRelativeUrl}${compileId}/${importedFileRelativeUrl}`

const { browser, pageLogs, pageErrors, executionResult } =
  await openBrowserPage(compiledHtmlFileUrl, {
    // headless: false,
  })
browser.close()

const actual = { pageLogs, pageErrors, executionResult }
const expectedParsingErrorMessage = `${importedFilePath}: Unexpected token (1:11)

> 1 | const a = (
    |            ^`
const expectedParsingError = {
  message: expectedParsingErrorMessage,
  messageHTML: assert.any(String),
  filename: importedFilePath,
  lineNumber: 1,
  columnNumber: 11,
}
const expectedError = Object.assign(
  new Error(`JavaScript module file cannot be parsed
--- parsing error message ---
${expectedParsingError.message}
--- file ---
${importedFileRelativeUrl}
--- file url ---
${compiledImportedFileUrl}`),
  {
    parsingError: expectedParsingError,
    filename: actual.executionResult.error.filename,
    lineno: actual.executionResult.error.lineno,
    columnno: actual.executionResult.error.columnno,
  },
)
const error500Log = {
  type: "error",
  text: "Failed to load resource: the server responded with a status of 500 (parse error)",
}
const expected = {
  pageLogs: [
    error500Log,
    { ...error500Log },
    {
      type: "error",
      text: assert.any(String),
    },
  ],
  pageErrors: [],
  executionResult: {
    status: "errored",
    startTime: assert.any(Number),
    endTime: assert.any(Number),
    fileExecutionResultMap: {
      [`./error_syntax.js`]: {
        status: "errored",
        exceptionSource: assert.any(String),
      },
    },
    error: expectedError,
  },
}
assert({ actual, expected })

{
  const stack = pageLogs[pageLogs.length - 1].text
  const expected = `Error: ${expectedError.message}`
  const actual = stack.slice(0, expected.length)
  assert({ actual, expected })
}
