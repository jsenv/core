import {
  urlToRelativeUrl,
  urlToFileSystemPath,
  resolveUrl,
} from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/jsenv_file_urls.js"
import { START_DEV_SERVER_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_DEV_SERVER.js"
import { openBrowserPage } from "@jsenv/core/test/open_browser_page.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlRelativeUrl = `${testDirectoryRelativeUrl}error_syntax.html`
const importedFileRelativeUrl = `${testDirectoryRelativeUrl}error_syntax.js`
const importedFileUrl = resolveUrl(
  importedFileRelativeUrl,
  jsenvCoreDirectoryUrl,
)
const importedFilePath = urlToFileSystemPath(importedFileUrl)
const test = async ({ runtimeReport }) => {
  const devServer = await startDevServer({
    ...START_DEV_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
  })
  const { compileId } = await devServer.createCompileIdFromRuntimeReport(
    runtimeReport,
  )
  let urlToVisit
  if (compileId) {
    const htmlCompiledRelativeUrl = `${devServer.jsenvDirectoryRelativeUrl}${compileId}/${htmlRelativeUrl}`
    urlToVisit = `${devServer.origin}/${htmlCompiledRelativeUrl}`
  } else {
    urlToVisit = `${devServer.origin}/${htmlRelativeUrl}`
  }
  const { browser, page, pageLogs, pageErrors, getJsenvExecutionResult } =
    await openBrowserPage({
      // debug: true,
    })
  await page.goto(urlToVisit)
  const executionResult = await getJsenvExecutionResult()
  browser.close()
  return {
    compileId,
    pageLogs,
    pageErrors,
    executionResult,
    devServer,
  }
}

const { pageLogs, pageErrors, executionResult, devServer, compileId } =
  await test({
    runtimeReport: {
      forceCompilation: true,
      moduleOutFormat: "systemjs",
    },
  })
const compiledImportedFileUrl = `${devServer.origin}/${devServer.jsenvDirectoryRelativeUrl}${compileId}/${importedFileRelativeUrl}`
const actual = { pageLogs, pageErrors, executionResult }

const expectedError = Object.assign(
  new Error(`JavaScript module file cannot be parsed
--- parsing error message ---
${importedFilePath}: Unexpected token (1:11)

  > 1 | const a = (
      |            ^
--- file ---
${importedFileRelativeUrl}
--- file url ---
${compiledImportedFileUrl}`),
  {
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
    scriptExecutionResults: {
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
