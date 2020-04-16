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

const { exploringServer } = await startExploring({
  ...START_EXPLORING_TEST_PARAMS,
  jsenvDirectoryRelativeUrl,
  htmlFileRelativeUrl,
})
const { browser, pageLogs, pageErrors, executionResult } = await openBrowserPage(
  `${exploringServer.origin}/${htmlFileRelativeUrl}?file=${fileRelativeUrl}`,
)
const actual = { pageLogs, pageErrors, executionResult }
const expected = {
  pageLogs: [
    actual.pageLogs[0], // eventSource connected log
    { type: "log", text: "42" },
    { type: "log", text: "bar" },
  ],
  pageErrors: [],
  executionResult: {
    status: "completed",
    namespace: { default: 42 },
  },
}
assert({ actual, expected })
browser.close()
