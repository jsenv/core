import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

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
const filename = `error_runtime.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const compileId = "best"
const test = async (params) => {
  const devServer = await startDevServer({
    ...START_DEV_SERVER_TEST_PARAMS,
    jsenvDirectoryRelativeUrl,
    ...params,
  })
  const compileDirectoryUrl = `${devServer.origin}/${devServer.outDirectoryRelativeUrl}${compileId}/`
  const compiledFileUrl = `${compileDirectoryUrl}${fileRelativeUrl}`

  const { browser, pageLogs, pageErrors, executionResult } =
    await openBrowserPage(compiledFileUrl, {
      headless: true,
    })
  browser.close()

  return {
    pageLogs,
    pageErrors,
    executionResult,
    devServer,
  }
}

{
  const { pageLogs, executionResult, devServer } = await test()
  const compileDirectoryUrl = `${devServer.origin}/${devServer.outDirectoryRelativeUrl}${compileId}/`
  const expectedErrorStack = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at triggerError (${compileDirectoryUrl}${testDirectoryRelativeUrl}trigger_error.js:2:9)
    at ${compileDirectoryUrl}${testDirectoryRelativeUrl}error_runtime.js:2:1`
  const expectedPageFirstLog = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at triggerError (${compileDirectoryUrl}${testDirectoryRelativeUrl}trigger_error.js:2:9)
    at ${compileDirectoryUrl}${testDirectoryRelativeUrl}error_runtime.js:2:1`
  const actual = {
    error: executionResult.error,
    pageFirstLog: pageLogs[0].text.slice(0, expectedPageFirstLog.length),
    errorStack: executionResult.error.stack.slice(0, expectedErrorStack.length),
  }
  const expected = {
    error: new Error("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"),
    pageFirstLog: expectedPageFirstLog,
    errorStack: expectedErrorStack,
  }
  assert({ actual, expected })
}

{
  const { pageLogs, executionResult, devServer } = await test({
    runtimeSupportDuringDev: {
      chrome: "93",
      firefox: "70",
    },
  })
  const expectedErrorStack = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
  at triggerError (${devServer.origin}/${testDirectoryRelativeUrl}trigger_error.js:2:9)
  at Object.triggerError (${devServer.origin}/${testDirectoryRelativeUrl}error_runtime.js:3:1)`
  const expectedPageFirstLog = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
  at triggerError (${devServer.origin}/${testDirectoryRelativeUrl}trigger_error.js:2:9)
  at Object.triggerError (${devServer.origin}/${testDirectoryRelativeUrl}error_runtime.js:3:1)`
  const actual = {
    error: executionResult.error,
    pageFirstLog: pageLogs[0].text.slice(0, expectedPageFirstLog.length),
    errorStack: executionResult.error.stack.slice(0, expectedErrorStack.length),
  }
  const expected = {
    error: Object.assign(new Error("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"), {
      filename: executionResult.error.filename,
      lineno: executionResult.error.lineno,
      columnno: executionResult.error.columnno,
    }),
    pageFirstLog: expectedPageFirstLog,
    errorStack: expectedErrorStack,
  }
  assert({ actual, expected })
}
