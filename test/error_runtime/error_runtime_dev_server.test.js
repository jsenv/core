import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"
import { assert } from "@jsenv/assert"

import { startDevServer } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { START_DEV_SERVER_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_DEV_SERVER.js"
import { openBrowserPage } from "@jsenv/core/test/open_browser_page.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(
  testDirectoryUrl,
  jsenvCoreDirectoryUrl,
)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const htmlRelativeUrl = `${testDirectoryRelativeUrl}error_runtime.html`
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

// no compilation (esmodule)
{
  const { pageLogs, executionResult, devServer } = await test({
    runtimeReport: {
      forceSource: true,
      moduleOutFormat: "esmodule",
    },
  })
  const expectedErrorStack = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at triggerError (${devServer.origin}/${testDirectoryRelativeUrl}trigger_error.js:2:9)
    at ${devServer.origin}/${testDirectoryRelativeUrl}error_runtime.js:3:1`
  const expectedPageFirstLog = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
    at triggerError (${devServer.origin}/${testDirectoryRelativeUrl}trigger_error.js:2:9)
    at ${devServer.origin}/${testDirectoryRelativeUrl}error_runtime.js:3:1`
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

// compilation esmodule
{
  const { pageLogs, executionResult, devServer, compileId } = await test({
    runtimeReport: {
      forceCompilation: true,
      moduleOutFormat: "esmodule",
    },
  })
  const compileDirectoryUrl = `${devServer.origin}/${devServer.jsenvDirectoryRelativeUrl}${compileId}/`
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

// compilation systemjs
{
  const { pageLogs, executionResult, devServer } = await test({
    runtimeReport: {
      moduleOutFormat: "systemjs",
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
