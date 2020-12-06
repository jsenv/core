import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "@jsenv/core/src/internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "@jsenv/core"
import { openBrowserPage } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryname}.main.html`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const compileId = "best"

const exploringServer = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
})
const compiledFileUrl = `${exploringServer.origin}/${exploringServer.outDirectoryRelativeUrl}${compileId}/${fileRelativeUrl}`

const { browser, pageLogs, pageErrors, executionResult } = await openBrowserPage(compiledFileUrl, {
  headless: true,
})
{
  const actual = { pageLogs, pageErrors, executionResult }
  const expected = {
    pageLogs: [{ type: "error", text: "JSHandle@error" }],
    pageErrors: [],
    executionResult: {
      status: "errored",
      startTime: assert.any(Number),
      endTime: assert.any(Number),
      fileExecutionResultMap: {
        "./throw.main.js": {
          status: "errored",
          exceptionSource: assert.any(String),
        },
      },
      error: Object.assign(new Error("error"), {
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
  const expected = `Error: error
  at triggerError (${exploringServer.origin}/test/startExploring/throw/trigger-error.js:2:9)
  at Object.triggerError (${exploringServer.origin}/test/startExploring/throw/throw.main.js:3:1)`
  const actual = stack.slice(0, expected.length)
  assert({ actual, expected })
}

browser.close()
