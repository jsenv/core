import { basename } from "path"
import { assert } from "@jsenv/assert"
import { resolveUrl, urlToRelativeUrl } from "@jsenv/util"
import { jsenvCoreDirectoryUrl } from "../../../src/internal/jsenvCoreDirectoryUrl.js"
import { startExploring } from "../../../index.js"
import { openBrowserPage } from "../openBrowserPage.js"
import { START_EXPLORING_TEST_PARAMS } from "../TEST_PARAMS.js"

const testDirectoryUrl = resolveUrl("./", import.meta.url)
const testDirectoryRelativeUrl = urlToRelativeUrl(testDirectoryUrl, jsenvCoreDirectoryUrl)
const testDirectoryname = basename(testDirectoryRelativeUrl)
const jsenvDirectoryRelativeUrl = `${testDirectoryRelativeUrl}.jsenv/`
const filename = `${testDirectoryname}.main.js`
const fileRelativeUrl = `${testDirectoryRelativeUrl}${filename}`
const parentDirectoryUrl = resolveUrl("../", testDirectoryUrl)
const parentDirectoryRelativeUrl = urlToRelativeUrl(parentDirectoryUrl, jsenvCoreDirectoryUrl)
const htmlFileRelativeUrl = `${parentDirectoryRelativeUrl}template.html`

const { exploringServer, compileServer } = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  htmlFileRelativeUrl,
})
const {
  browser,
  pageLogs,
  pageErrors,
  executionResult,
} = await openBrowserPage(
  `${exploringServer.origin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`,
  { headless: true },
)
{
  const actual = { pageLogs, pageErrors, executionResult }
  const expected = {
    pageLogs: [{ type: "error", text: "JSHandle@error" }],
    pageErrors: [],
    executionResult: {
      status: "errored",
      error: new Error("error"),
    },
  }
  assert({ actual, expected })
}
{
  const actual = executionResult.error.stack
  const expected = `Error: error
  at triggerError (${compileServer.origin}/test/startExploring/throw/trigger-error.js:2:9)
  at Object.triggerError (${compileServer.origin}/test/startExploring/throw/throw.main.js:3:1)
  at call (${compileServer.origin}/src/internal/platform/s.js:358:34)
  at doExec (${compileServer.origin}/src/internal/platform/s.js:354:12)
  at postOrderExec (${compileServer.origin}/src/internal/platform/s.js:317:14)`
  assert({ actual, expected })
}

browser.close()
