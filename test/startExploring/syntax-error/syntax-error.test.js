import { basename } from "path"
import { assert } from "@jsenv/assert"
import {
  resolveDirectoryUrl,
  urlToRelativeUrl,
  urlToFilePath,
  resolveUrl,
} from "internal/urlUtils.js"
import { jsenvCoreDirectoryUrl } from "internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../../index.js"
import { openBrowserPage } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveDirectoryUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlFileUrl = import.meta.resolve("../template.html")
const htmlFileRelativeUrl = urlToRelativeUrl(htmlFileUrl, jsenvCoreDirectoryUrl)
const filename = `${testDirectoryname}.main.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const filePath = urlToFilePath(resolveUrl(fileRelativeUrl, jsenvCoreDirectoryUrl))

const { origin: browserExplorerServerOrigin, compileServerOrigin } = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  htmlFileUrl,
})
const { browser, pageLogs, pageErrors, executionResult } = await openBrowserPage(
  `${browserExplorerServerOrigin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`,
)
const actual = { pageLogs, pageErrors, executionResult }

const expectedParsingErrorMessage = `${filePath}: Unexpected token (1:17)

> 1 | const browser = (
    |                  ^`
const expectedParsingError = {
  message: expectedParsingErrorMessage,
  messageHTML: expectedParsingErrorMessage,
  filename: filePath,
  lineNumber: 1,
  columnNumber: 17,
}
const expectedError = new Error(`imported module parsing error.
--- parsing error message ---
${expectedParsingError.message}
--- url ---
${compileServerOrigin}/${jsenvDirectoryRelativeUrl}out/best/${fileRelativeUrl}
--- importer url ---
undefined`)
Object.assign(expectedError, {
  parsingError: expectedParsingError,
})

const expected = {
  pageLogs: [
    {
      type: "error",
      text: "Failed to load resource: the server responded with a status of 500 (parse error)",
    },
    { type: "error", text: "JSHandle@error" },
  ],
  pageErrors: [],
  executionResult: {
    status: "errored",
    error: expectedError,
  },
}
assert({ actual, expected })
browser.close()
