import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/filesystem"

import { startExploring } from "@jsenv/core"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { START_EXPLORING_TEST_PARAMS } from "@jsenv/core/test/TEST_PARAMS_EXPLORING.js"
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

const exploringServer = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const compiledFileUrl = `${exploringServer.origin}/${exploringServer.outDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`

const { browser, pageLogs, pageErrors, executionResult } =
  await openBrowserPage(compiledFileUrl, {
    headless: true,
  })
browser.close()

{
  const actual = { pageLogs, pageErrors, executionResult }
  const expected = {
    pageLogs: [
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
        [`./error_runtime.js`]: {
          status: "errored",
          exceptionSource: assert.any(String),
        },
      },
      error: Object.assign(new Error("SPECIAL_STRING_UNLIKELY_TO_COLLIDE"), {
        filename: actual.executionResult.error.filename,
        lineno: actual.executionResult.error.lineno,
        columnno: actual.executionResult.error.columnno,
      }),
    },
  }
  assert({ actual, expected })
}

{
  const stack = executionResult.error.stack
  const expected = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
  at triggerError (${exploringServer.origin}/${testDirectoryRelativeUrl}trigger_error.js:2:9)
  at Object.triggerError (${exploringServer.origin}/${testDirectoryRelativeUrl}error_runtime.js:3:1)`
  const actual = stack.slice(0, expected.length)
  assert({ actual, expected })
}

{
  const stack = pageLogs[0].text
  const expected = `Error: SPECIAL_STRING_UNLIKELY_TO_COLLIDE
  at triggerError (${exploringServer.origin}/${testDirectoryRelativeUrl}trigger_error.js:2:9)
  at Object.triggerError (${exploringServer.origin}/${testDirectoryRelativeUrl}error_runtime.js:3:1)`
  const actual = stack.slice(0, expected.length)
  assert({ actual, expected })
}
